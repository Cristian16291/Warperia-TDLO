import axios from "axios";
import { WEB_URL } from "./../../config.js";
import fetchComplementos from "./fetchComplementos.js";

/**
 * Checks for installed addons in the specified game path
 */
const checkInstalaredComplementos = async (gamePath, params = {}) => {
  const {
    setScanningComplementos,
    isPathInsideDirectory,
    showToastMessage,
    window,
    allComplementos,
    setAllComplementos,
    parseGitFingerprint,
    checkIfGitHubOutdated,
    currentExpansion,
    setModalQueue,
    setShowAddonSelectionModal,
    setCurrentModalData,
    setInstalaredComplementos
  } = params;

  try {
    setScanningComplementos(true);

    // 1) Normalize the path to Interface/AddOns
    const absoluteGameDir = window.electron.pathResolve(gamePath);
    const addonsDir = window.electron.pathJoin(
      absoluteGameDir,
      "Interface",
      "AddOns"
    );

    // 2) Validate that the addonsDir is inside the gameDir
    if (!isPathInsideDirectory(addonsDir, absoluteGameDir)) {
      console.error("Invalid game directory:", addonsDir);
      showToastMessage("Invalid game directory.", "danger");
      return;
    }

    // 3) Get all top-level folders in the AddOns directory
    const addonFolders = await window.electron.readDir(addonsDir);

    // 4) Make sure we have the full list of allComplementos; if not, fetch them in batches
    let fetchedComplementos = allComplementos;
    if (!fetchedComplementos || fetchedComplementos.length === 0) {
      let currentPage = 1;
      const pageSize = 100;
      let totalPages = 1;

      do {
        const { data: batchComplementos, totalPages: fetchedTotalPages } =
          await fetchComplementos(
            `${currentExpansion}`, // Post type or expansion
            currentPage,
            "",
            [],
            pageSize
          );
        fetchedComplementos = [...fetchedComplementos, ...batchComplementos];
        totalPages = fetchedTotalPages || 1;
        currentPage++;
      } while (currentPage <= totalPages);

      setAllComplementos(fetchedComplementos);
    }

    if (fetchedComplementos.length === 0) {
      let currentPage = 1;
      const pageSize = 100;
      let totalPages = 1;
      do {
        const { data: batchComplementos, totalPages: fetchedTotalPages } =
          await fetchComplementos(
            `${currentExpansion}`,
            currentPage,
            "",
            [],
            pageSize
          );
        fetchedComplementos = [...fetchedComplementos, ...batchComplementos];
        totalPages = fetchedTotalPages || 1;
        currentPage++;
      } while (currentPage <= totalPages);
      setAllComplementos(fetchedComplementos);
    }

    /*
     * 5) Create a mapping from MAIN folders to addons ONLY.
     * This prevents subfolders from incorrectly matching another addon
     */
    const folderNameToComplementos = {};
    fetchedComplementos.forEach((addon) => {
      if (addon.custom_fields && addon.custom_fields.folder_list) {
        addon.custom_fields.folder_list.forEach(([folderName, isMain]) => {
          if (isMain === "1") {
            if (!folderNameToComplementos[folderName]) {
              folderNameToComplementos[folderName] = [];
            }
            folderNameToComplementos[folderName].push(addon);
          }
        });
      }
    });

    /*
     * We'll store discovered addons in matchedComplementos,
     * plus any conflicts in modalQueueTemp for AddonSelectionModal.
     */
    const matchedComplementos = {};
    let modalQueueTemp = [];

    // 6) Iterate over each folder in the user's AddOns directory
    await Promise.all(
      addonFolders.map(async (folder) => {
        const folderPath = window.electron.pathJoin(addonsDir, folder);

        // Skip if no addon claims this folder as its main folder
        const matchingComplementos = folderNameToComplementos[folder] || [];
        if (matchingComplementos.length === 0) {
          return;
        }

        // Read version from .toc if it exists
        const tocFile = window.electron.pathJoin(folderPath, `${folder}.toc`);
        let tocVersion = "1.0.0";
        if (await window.electron.fileExists(tocFile)) {
          const versionFromToc = await window.electron.readVersionFromToc(
            tocFile
          );
          tocVersion = versionFromToc || tocVersion;
        }

        // Check for .warperia file to see if we can identify which exact addon ID was installed
        const warperiaFile = window.electron.pathJoin(
          folderPath,
          `${folder}.warperia`
        );
        const warperiaExists = await window.electron.fileExists(warperiaFile);

        // Create the .warperia file if it doesn't exist
        if (!warperiaExists && matchingComplementos.length === 1) {
          const matchedAddon = matchingComplementos[0];
          try {
            const warperiaContent = `ID: ${
              matchedAddon.id
            }\nFolders: ${matchedAddon.custom_fields.folder_list
              .map(([f]) => f)
              .join(",")}\nFilename: ${matchedAddon.custom_fields.file
              .split("/")
              .pop()}`;

            await window.electron.writeFile(warperiaFile, warperiaContent);
          } catch (error) {
            console.error(
              `Failed to create .warperia file for ${folder}:`,
              error
            );
          }
        }

        let storedFilename = "";
        let localGitFingerprint = null;
        let localWordPressVersion = "";

        if (await window.electron.fileExists(warperiaFile)) {
          const warperiaContent = await window.electron.readFile(warperiaFile);
          const installedAddonId = warperiaContent.match(/ID:\s*(\d+)/)?.[1];
          const filenameMatch = warperiaContent.match(/Filename:\s*(.+)/);
          const localWpVersionMatch = warperiaContent.match(
            /^WordPressVersion:\s*(.+)$/m
          );
          let localWordPressVersion = "";
          if (localWpVersionMatch) {
            localWordPressVersion = localWpVersionMatch[1].trim();
          }
          const localGitFingerprint = parseGitFingerprint(warperiaContent);
          if (filenameMatch) {
            storedFilename = filenameMatch[1];
          }

          if (!filenameMatch) {
            const matchedAddon = fetchedComplementos.find(
              (a) => a.id === parseInt(installedAddonId, 10)
            );
            if (matchedAddon) {
              const addonUrl = matchedAddon.custom_fields.file;
              const newFilename = addonUrl.split("/").pop();
              const newWarperia-TDLOContent = `${warperiaContent}\nFilename: ${newFilename}`;

              await window.electron.overwriteFile(
                warperiaFile,
                newWarperia-TDLOContent
              );
              storedFilename = newFilename;
            }
          } else {
            storedFilename = filenameMatch[1];
          }

          if (installedAddonId) {
            const matchedAddon = fetchedComplementos.find(
              (a) => a.id === parseInt(installedAddonId, 10)
            );
            if (matchedAddon) {
              // Check if any subfolders are missing (corruption check)
              const allAddonFolders =
                matchedAddon.custom_fields.folder_list.map(([f]) => f);
              const missingFolders = allAddonFolders.filter(
                (sub) => !addonFolders.includes(sub)
              );

              matchedComplementos[folder] = {
                ...matchedAddon,
                corrupted: missingFolders.length > 0,
                missingFolders,
                localVersion: tocVersion,
                storedFilename,
                localGitFingerprint,
                localWordPressVersion,
              };
              return; // Done with this folder
            }
          }
        }

        // If there's exactly one matching addon, no conflict
        if (matchingComplementos.length === 1) {
          const matchedAddon = matchingComplementos[0];
          const allAddonFolders = matchedAddon.custom_fields.folder_list.map(
            ([f]) => f
          );
          const missingFolders = allAddonFolders.filter(
            (sub) => !addonFolders.includes(sub)
          );

          matchedComplementos[folder] = {
            ...matchedAddon,
            corrupted: missingFolders.length > 0,
            missingFolders,
            localVersion: tocVersion,
            storedFilename,
            localGitFingerprint,
            localWordPressVersion,
          };
          return;
        }

        // Otherwise, multiple main folder claims
        modalQueueTemp.push(matchingComplementos);
      })
    );

    // 7) If conflicts were found, open the addon selection modal
    if (modalQueueTemp.length > 0) {
      setModalQueue(modalQueueTemp);
      setCurrentModalData(modalQueueTemp[0]);
      setShowAddonSelectionModal(true);
    }

    // 7.5) For each installed addon, if it has a GitHub link & local fingerprint, check if there's a new commit/release
    // This makes Warperia-TDLO "see" a new commit on refresh
    for (const folderName of Object.keys(matchedComplementos)) {
      const installedAddon = matchedComplementos[folderName];
      const isOutdatedOnGitHub = await checkIfGitHubOutdated(installedAddon);
      if (isOutdatedOnGitHub) {
        installedAddon.corrupted = true;
      }
      matchedComplementos[folderName] = installedAddon;
    }

    // 8) Actualizar our state for all installed addons we confidently matched
    setInstalaredComplementos({ ...matchedComplementos });
  } catch (error) {
    console.error("Error checking installed addons:", error);
  } finally {
    setScanningComplementos(false);
  }
};

export default checkInstalaredComplementos;
