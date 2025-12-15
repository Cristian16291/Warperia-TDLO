import React, {
    useState,
    useEffect,
    useRef,
    useCallback,
    useMemo,
    lazy,
    Suspense,
} from "react";
import axios from "axios";
import ContextMenu from "../components/ContextMenu.js";
import fetchComplementos from "./../utils/fetchComplementos.js";
import Pagination from "./../components/Pagination.js";
import Select from "react-select";
import Tippy from "@tippyjs/react";
import ToastNotifications from "./../components/ToastNotifications.js";
import updateAddonInstalarStats from "../utils/updateAddonInstalarStats.js";
import updateAddonUninstallStats from "../utils/updateAddonUninstallStats.js";
import useDebouncedBuscar from "./../utils/useDebouncedBuscar.js";
import { WEB_URL } from "./../../config.js";
import { GITHUB_TOKEN } from "./../../config.js";
import cleanupDescargar from "../utils/cleanupDescargar.js";
import handleAddonInstalaration from "../utils/handleAddonInstalaration.js";
import checkInstalaredComplementos from "../utils/checkInstalaredComplementos.js";

// Stylesheets
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "tippy.js/dist/tippy.css";

// Addon Modals
const SwitchVariationModal = lazy(() =>
    import("../components/Modals/SwitchVariationModal.js")
);
const AddonSelectionModal = lazy(() =>
    import("../components/Modals/AddonSelectionModal.js")
);
const ReportModal = lazy(() => import("../components/Modals/ReportModal.js"));
const ExportModal = lazy(() => import("../components/Modals/ExportModal.js"));
const ImportModal = lazy(() => import("../components/Modals/ImportModal.js"));
import DeleteConfirmationModal from "../components/Modals/DeleteConfirmationModal.js";
const AddonModal = lazy(() => import("../components/Modals/AddonModal.js"));

// Addon Cards
import InstalaredAddonCard from "./../components/Cards/InstalaredAddonCard.js";
import BrowseAddonCard from "./../components/Cards/BrowseAddonCard.js";
const GITHUB_ACCESS_TOKEN = `${GITHUB_TOKEN}`;

const ComplementosPage = ({
    user,
    currentExpansion,
    serverPath,
    gamePath,
    activeTab,
    setActiveTab,
    serverId
}) => {
    const [allComplementos, setAllComplementos] = useState([]);
    const [expandedComplementos, setExpandedComplementos] = useState([]);
    const [addons, setComplementos] = useState([]);
    const [authors, setAuthors] = useState({});
    const [gameDir, setGameDir] = useState(null);
    const [loading, setLoading] = useState(true);
    const [initialLoading, setInitialLoading] = useState(true);
    const [scanningComplementos, setScanningComplementos] = useState(false);
    const [downloading, setDescargaring] = useState(false);
    const [installingAddonId, setInstalaringAddonId] = useState(null);
    const [installedComplementos, setInstalaredComplementos] = useState({});
    const [corruptedComplementos, setCorruptedComplementos] = useState({});
    const [contextMenu, setContextMenu] = useState({
        visible: false,
        xPos: 0,
        yPos: 0,
        addon: null,
    });
    const [showModal, setShowModal] = useState(false);
    const [addonLoading, setAddonLoading] = useState(false);
    const [selectedAddon, setSelectedAddon] = useState(null);
    const [categories, setCategories] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    const [selectedSorting, setSelectedSorting] = useState({
        value: "installs",
        label: "Most Popular",
    });
    const [previousPage, setPreviousPage] = useState(1);
    const [previousSorting, setPreviousSorting] = useState({
        value: "installs",
        label: "Most Popular",
    });
    const [userId, setUserId] = useState(null);
    const [settings, setAjustes] = useState(null); // Backend Ajustes

    // Sticky Headers
    const mainHeaderRef = useRef(null);
    const containerRef = useRef(null);

    // Addon Selection
    const [showAddonSelectionModal, setShowAddonSelectionModal] = useState(false);
    const [modalQueue, setModalQueue] = useState([]);
    const [currentModalData, setCurrentModalData] = useState(null);

    // Addon Variations Switching
    const [showSwitchModal, setShowSwitchModal] = useState(false);
    const [loadingVariations, setLoadingVariations] = useState(false);
    const [availableVariations, setAvailableVariations] = useState([]);
    const [currentAddon, setCurrentAddon] = useState(null);

    // Addon Reporting
    const [showReportModal, setShowReportModal] = useState(false);
    const [currentAddonForReport, setCurrentAddonForReport] = useState(null);

    // Addon Export and Import
    const [showExportModal, setShowExportModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);

    // Addon Delete Confirmation For Bundles
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteModalData, setDeleteModalData] = useState({
        addon: null,
        parents: [],
        children: []
    });

    // Toast notifications state
    const [toasts, setToasts] = useState([]);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const pageSize = 20;

    // Buscar state
    const [searchQuery, setBuscarQuery] = useState("");

    // Buscar state for installed addons
    const [installedBuscarQuery, setInstalaredBuscarQuery] = useState('');

    // Sorting Opciones
    const sortingOpciones = [
        { value: "installs", label: "Most Popular" },
        { value: "recently_added", label: "Recently Added" },
        { value: "recently_updated", label: "Recently Actualizard" },
    ];

    // Addon Instalaration Progress
    const [installingAddonStep, setInstalaringAddonStep] = useState(null);
    const [progress, setProgress] = useState(0);
    const [autoProgressTimer, setAutoProgressTimer] = useState(null);
    const [artificialProgress, setArtificialProgress] = useState(0);
    const [queuedComplementos, setQueuedComplementos] = useState([]);

    // Toggle the accordion open/close for a given addon ID.
    function toggleAddonExpansion(addonId) {
        setExpandedComplementos((prev) => {
            if (prev.includes(addonId)) {
                return prev.filter((id) => id !== addonId);
            } else {
                return [...prev, addonId];
            }
        });
    }

    // Utility function to check if a path is inside a directory
    const isPathInsideDirectory = (childPath, parentPath) => {
        const normalizedChild = window.electron.pathNormalize(childPath);
        const normalizedParent = window.electron.pathNormalize(parentPath);

        // Check if the child path is inside the parent or equal to the parent
        const relative = window.electron.pathRelative(
            normalizedParent,
            normalizedChild
        );
        return (
            relative === "" ||
            (!relative.startsWith("..") && !window.electron.pathIsAbsolute(relative))
        );
    };

    useEffect(() => {
        if (user && user.id) {
            setUserId(user.id);
        }
    }, [user]);

    const retry = async (fn, retries = 3, delay = 1000) => {
        try {
            return await fn();
        } catch (err) {
            if (retries > 1) {
                console.warn(`Retrying... (${retries - 1} attempts left)`);
                await new Promise((res) => setTimeout(res, delay));
                return retry(fn, retries - 1, delay);
            } else {
                throw err;
            }
        }
    };

    useEffect(() => {
        // Fetch the WordPress settings
        const fetchAjustes = async () => {
            try {
                const response = await axios.get(
                    `${WEB_URL}/wp-json/wp/v2/site-settings`
                );
                setAjustes(response.data);
            } catch (error) {
                console.error("Error fetching settings:", error);
            }
        };

        fetchAjustes();
    }, []);

    useEffect(() => {
        const initializeGameDirectory = async () => {
            if (!user || !gamePath || !currentExpansion) {
                console.error("User, server path, or expansion not found.");
                return;
            }

            try {
                // Normalize and resolve the game path
                const sanitizedGamePath = window.electron.pathNormalize(
                    window.electron.pathResolve(gamePath)
                );

                // Remove the executable from the path if present
                const sanitizedPath = sanitizedGamePath.replace(
                    /\\[^\\]+\.exe(\.exe)?$/i,
                    ""
                );

                // Validate the game directory path
                if (!isPathInsideDirectory(sanitizedPath, sanitizedGamePath)) {
                    console.error("Invalid game directory:", sanitizedPath);
                    showToastMessage("Invalid game directory.", "danger");
                    return;
                }

                setGameDir(sanitizedPath);
                await scanForInstalaredComplementos(sanitizedPath);
            } catch (error) {
                console.error("Failed to initialize game directory:", error);
            } finally {
                setInitialLoading(false);
            }
        };

        initializeGameDirectory();
    }, [user, gamePath, currentExpansion]);

    useEffect(() => {
        const fetchAllComplementos = async () => {
            try {
                let fetchedComplementos = [];
                let currentPage = 1;
                const pageSize = 100;
                let totalPages = 1;

                // Fetch all addons from the backend in batches
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
            } catch (error) {
                console.error("Error fetching all addons:", error);
            }
        };

        fetchAllComplementos();
    }, []);

    // Actualizar the user's installed addons
    const refreshComplementosData = async (zipPath) => {
        setAllComplementos([]);
        await scanForInstalaredComplementos(gameDir);
        if (zipPath) {
            await cleanupDescargar(zipPath);
        }
    };

    const fetchComplementosData = useCallback(
        async (
            page = 1,
            search = "",
            categories = [],
            orderby = selectedSorting.value
        ) => {
            try {
                setLoading(true);
                const { data, totalPages } = await fetchComplementos(
                    `${currentExpansion}`,
                    page,
                    search,
                    categories,
                    pageSize,
                    orderby,
                    "desc"
                );

                setComplementos(data);
                setTotalPages(totalPages || 1);
                setCurrentPage(page);
            } catch (error) {
                console.error("Error fetching addons:", error);
                setComplementos([]);
                setTotalPages(1);
            } finally {
                setLoading(false);
            }
        },
        [selectedSorting.value, selectedCategories, searchQuery]
    );

    // Load the author infromation for addons
    useEffect(() => {
        addons.forEach((addon) => {
            const authorId = addon?.post_author || addon?.author_id;
            if (authorId && !authors[authorId]) {
                fetchAuthorInfo(authorId);
            }
        });
    }, [addons, authors, fetchAuthorInfo]);

    // Fetch the author information based on their ID
    const fetchAuthorInfo = async (authorId) => {
        try {
            const { data } = await axios.get(
                `${WEB_URL}/wp-json/wp/v2/public-user-info/${authorId}`
            );
            setAuthors((prevAuthors) => ({ ...prevAuthors, [authorId]: data }));
        } catch (error) {
            console.error(`Failed to fetch author info for ID ${authorId}`, error);
        }
    };

    // Make sure the addon author information is fetched before we try to display it
    useEffect(() => {
        if (activeTab === "myComplementos" && Object.keys(installedComplementos).length > 0) {
            Object.values(installedComplementos).forEach((addon) => {
                const authorId = addon?.post_author || addon?.author_id;
                if (authorId && !authors[authorId]) {
                    fetchAuthorInfo(authorId);
                }
            });
        }
    }, [activeTab, installedComplementos, authors]);

    useEffect(() => {
        if (activeTab === "browseComplementos" && searchQuery === "") {
            fetchComplementosData(
                currentPage,
                "",
                selectedCategories.map((option) => option.value)
            );
        } else if (activeTab === "myComplementos") {
            if (gameDir) {
                scanForInstalaredComplementos(gameDir);
            }
        }
    }, [
        activeTab,
        currentPage,
        selectedCategories,
        fetchComplementosData,
        searchQuery,
    ]);

    // Load the addon categories
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await axios.get(
                    `${WEB_URL}/wp-json/wp/v2/${currentExpansion}-addon-categories`
                );
                setCategories(response.data);
            } catch (error) {
                console.error("Error fetching categories:", error);
            }
        };

        fetchCategories();
    }, []);

    // Logic for showing addon creators
    const renderAddonAuthor = (addon, hideImage = false) => {
        const isAuthorCreator = addon?.custom_fields?.iam_creator === "1";
        const creatorName = addon?.custom_fields?.creator;
        const authorId = addon?.post_author || addon?.author_id;
        const authorData = authors[authorId];

        if (!authorData) {
            return <span>Loading...</span>;
        }

        const authorName = isAuthorCreator && authorData
            ? authorData.display_name
            : creatorName || "N/A";

        if (hideImage && (authorName === "Unknown" || authorName === "N/A")) {
            return <span>Unknown</span>;
        }

        if (hideImage) {
            return <span>{authorName}</span>;
        }

        const avatarUrl =
            isAuthorCreator && authorData
                ? authorData.avatar_url
                : "public/no-avatar.jpg";

        return (
            <div className="d-flex align-items-center gap-2">
                <img
                    src={avatarUrl}
                    alt={authorName}
                    className="img-fluid"
                    width={15}
                    height={15}
                />
                <span>{authorName}</span>
            </div>
        );
    };

    const handleCategoryChange = async (selectedOpciones) => {
        setSelectedCategories(selectedOpciones);
        const categoryIds = selectedOpciones.map((option) => option.value);

        if (categoryIds.length > 0) {
            setBuscarQuery(""); // Clear search query when filtering by categories
            await fetchComplementosData(1, "", categoryIds, selectedSorting.value);
        } else {
            await fetchComplementosData(1, "", [], selectedSorting.value); // Pass an empty array for categories if none are selected
        }
    };

    const handleSortingChange = async (selectedOption) => {
        setSelectedSorting(selectedOption);
        setPreviousSorting(selectedOption); // Actualizar previousSorting whenever sorting changes
        setCurrentPage(1); // Reset to page 1 when sorting changes
        await fetchComplementosData(
            1,
            searchQuery,
            selectedCategories.map((option) => option.value),
            selectedOption.value
        );
    };

    useEffect(() => {
        if (installedComplementos && Object.keys(installedComplementos).length > 0) {
            setLoading(false); // Ensure rendering only after the state is set
        }
    }, [installedComplementos]);

    const currentPostType = `addon-${currentExpansion}`;
    const debouncedBuscar = useDebouncedBuscar(
        setLoading,
        setComplementos,
        setTotalPages,
        setCurrentPage,
        selectedCategories,
        activeTab,
        setActiveTab,
        currentPostType,
        selectedSorting
    );

    const handleBuscarChange = (event) => {
        const value = event.target.value;
        setBuscarQuery(value);

        if (value === "") {
            // Restore the original page and sorting after clearing search
            setSelectedSorting(previousSorting);
            setCurrentPage(previousPage);
            fetchComplementosData(
                previousPage,
                "",
                selectedCategories.map((option) => option.value),
                previousSorting.value
            );
        } else {
            // Only update previous page/sorting when starting new search
            if (searchQuery === "") {
                setPreviousPage(currentPage);
                setPreviousSorting(selectedSorting);
            }
            debouncedBuscar(value, pageSize);
        }
    };

    const handleViewAddon = async (addonParam) => {
        const addonToView = addonParam || contextMenu.addon;
        if (!addonToView) return;

        setShowModal(true);
        setSelectedAddon(null);
        setAddonLoading(true);

        try {
            const response = await axios.get(
                `${WEB_URL}/wp-json/wp/v2/${currentExpansion}-addons/${addonToView.id}`
            );
            setSelectedAddon(response.data);
        } catch (error) {
            console.error("Error fetching addon details:", error);
            showToastMessage("Failed to load addon details.", "danger");
        } finally {
            setAddonLoading(false);
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedAddon(null);
    };

    /**
    * Finds all parent addons that contain the child's main folder in their folder_list.
    *
    * @param {object} childAddon - The installed addon whose parents we're finding.
    * @param {object} installedComplementos - The full installedComplementos object keyed by folder name.
    * @return {Array} Array of parent addons (each item is an addon object).
    */
    function findParentComplementos(childAddon, installedComplementos) {
        if (!childAddon?.custom_fields?.folder_list) return [];

        // Identify the child's main folder
        const mainFolderEntry = childAddon.custom_fields.folder_list.find(
            ([_, isMain]) => isMain === "1"
        );
        if (!mainFolderEntry) {
            return [];
        }
        const [childMainFolderName] = mainFolderEntry;

        // Check all installed addons to see if they contain that folder (and aren't the same addon)
        const parents = [];
        for (const key in installedComplementos) {
            const possibleParent = installedComplementos[key];
            if (!possibleParent?.custom_fields?.folder_list) continue;
            if (possibleParent.id === childAddon.id) continue; // exclude itself
            const hasChildFolder = possibleParent.custom_fields.folder_list.some(
                ([f]) => f === childMainFolderName
            );
            if (hasChildFolder) {
                parents.push(possibleParent);
            }
        }
        return parents;
    }

    /**
    * For a given "parent" addon, find all installed "child" addons that are
    * physically included in the parent's folder_list. 
    * 
    * The parent's folder_list might have multiple subfolders. Any installed
    * addon whose "main folder" is in that list is considered a "child".
    */
    function findChildComplementos(parentAddon, installedComplementos) {
        if (!parentAddon?.custom_fields?.folder_list) return [];

        // Gather all folder names from the parent's folder_list
        const parentFolders = parentAddon.custom_fields.folder_list.map(([f]) => f);

        // Then check each installed addon to see if that addon's main folder is in the parent's folder_list
        const children = [];
        for (const key in installedComplementos) {
            const candidate = installedComplementos[key];
            if (candidate.id === parentAddon.id) continue; // skip itself
            const mainFolderEntry = candidate.custom_fields?.folder_list?.find(
                ([_, isMain]) => isMain === "1"
            );
            if (!mainFolderEntry) continue;
            const [childMainFolder] = mainFolderEntry;

            // If the parent's folder list includes this child's main folder, we consider it a child
            if (parentFolders.includes(childMainFolder)) {
                children.push(candidate);
            }
        }
        return children;
    }

    /**
    * Recursively gather all sub-addons (direct and nested) under a given addon.
    * @param {object} parentAddon
    * @param {object} installedComplementos
    * @returns {Set} a set of all nested addons
    */
    function gatherAllSubComplementos(parentAddon, installedComplementos) {
        const result = new Set();
        function recurse(currentAddon) {
            // Find immediate children:
            const children = findChildComplementos(currentAddon, installedComplementos);
            for (const child of children) {
                if (!result.has(child)) {
                    result.add(child);
                    recurse(child); // go deeper
                }
            }
        }
        recurse(parentAddon);
        return result;
    }

    // Decode HTML entities in a string
    const decodeHtmlEntities = (text) => {
        const textArea = document.createElement("textarea");
        textArea.innerHTML = text;
        return textArea.value;
    };

    const normalizeTitle = (title) => {
        if (!title) return "";

        const decodedTitle = decodeHtmlEntities(title).toLowerCase();

        // Strip WoW color codes, hyperlinks, textures, or other WoW-specific formatting
        let normalizedTitle = decodedTitle
            .replace(/\|c[0-9a-fA-F]{8}/g, "") // Removes |cxxxxxxxx (color codes)
            .replace(/\|r/g, "") // Removes |r (reset color code)
            .replace(/(\|H.*?\|h|\|T.*?\|t|\|A.*?\|a)/g, "") // Removes other WoW tags
            .replace(/[<>]/g, "") // Removes symbols like < and > that are often added in titles
            .replace(/\s+/g, " ") // Replace multiple spaces with a single space
            .replace(/[-\s]*Ace\d*[-\s]*/gi, "") // Remove common suffixes like " -Ace2-"
            .replace(
                /classic|retail|tbc|shadowlands|2024|2023|[-\s]*ace\d*[-\s]*/gi,
                ""
            ) // Remove common suffixes
            .replace(/[-\s]+$/, "") // Trim trailing dashes or spaces
            .replace(/v?\d+(\.\d+)*$/i, "") // Remove version numbers like "v3.7.1" or "3.7.1"
            .trim()
            .toLowerCase();

        // Normalize quotes and special characters
        normalizedTitle = normalizedTitle
            .replace(/[\u2018\u2019\u201A\u201B]/g, "'") // Normalize single quotes
            .replace(/[\u201C\u201D\u201E\u201F]/g, '"'); // Normalize double quotes

        return normalizedTitle;
    };

    // Recursively copy all files/subfolders from src to dest.
    async function copyFolderRecursively(src, dest) {
        // Ensure the destination folder exists
        await window.electron.createFolder(dest);
    
        // readDirAndFiles must *not* filter out .blp or other extensions
        const { files, directories } = await window.electron.readDirAndFiles(src);
    
        // 1) Copy over all files in `src`
        for (const file of files) {
            const srcFilePath = window.electron.pathJoin(src, file);
            const destFilePath = window.electron.pathJoin(dest, file);
    
            // Read & write
            const content = await window.electron.readBinaryFile(srcFilePath);
            await window.electron.overwriteFile(destFilePath, content);
        }
    
        // 2) Recursively copy all subfolders
        for (const dir of directories) {
            const srcSub = window.electron.pathJoin(src, dir);
            const destSub = window.electron.pathJoin(dest, dir);
            await copyFolderRecursively(srcSub, destSub);
        }
    }

    /**
   * Move all subfolders from `srcParent` directly into `dstFolder`.
   * Then remove `srcParent` itself. This "flattens" one level of nesting.
   */
    async function flattenSingleExtractedFolder(srcParent, dstFolder) {
        // Read the entire contents
        const { files, directories } = await window.electron.readDirAndFiles(srcParent);
    
        // 1) Move/copy each file
        for (const file of files) {
            const oldFilePath = window.electron.pathJoin(srcParent, file);
            const newFilePath = window.electron.pathJoin(dstFolder, file);
    
            // Copy file content
            const fileContent = await window.electron.readBinaryFile(oldFilePath);
            await window.electron.overwriteFile(newFilePath, fileContent);
    
            // Optionally delete the old file
            await window.electron.deleteFile(oldFilePath);
        }
    
        // 2) Recursively copy each subfolder
        for (const dir of directories) {
            const oldSubPath = window.electron.pathJoin(srcParent, dir);
            const newSubPath = window.electron.pathJoin(dstFolder, dir);
    
            await copyFolderRecursively(oldSubPath, newSubPath);
            await window.electron.deleteFolder(oldSubPath);
        }
    
        // 3) Finally remove srcParent
        await window.electron.deleteFolder(srcParent);
    }

    // Check if the newly extracted folder actually contains multiple subfolders
    async function hasMultipleSubfolders(extractedParentPath, addonFolderList) {
        // Gather every subdirectory in the extracted parent
        const { directories } = await window.electron.readDirAndFiles(extractedParentPath);
        const expectedFolders = addonFolderList.map(([folderName]) => folderName);
        let matchCount = 0;
        for (const dir of directories) {
            if (expectedFolders.includes(dir)) {
                matchCount++;
            }
        }
        return matchCount >= 2;
    }

    // Fetch GitHub information
    async function fetchGitHubFingerprint(owner, repo, token) {
        let latestReleaseTag = "";
        let latestReleaseDate = null;
        let latestCommitSha = "";
        let latestCommitDate = null;

        // 1) Attempt to fetch the latest release
        try {
            const releaseRes = await axios.get(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (releaseRes.data && releaseRes.data.tag_name && releaseRes.data.published_at) {
                latestReleaseTag = releaseRes.data.tag_name; 
                latestReleaseDate = new Date(releaseRes.data.published_at);
            }
        } catch (err) {
        }

        // 2) Fetch repo info for the default branch
        const repoMeta = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const defaultBranch = repoMeta.data.default_branch || "main";

        // 3) Fetch the latest commit on default branch
        const commitRes = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/commits/${defaultBranch}`,
            {
                headers: { Authorization: `Bearer ${token}` },
            }
        );
        if (commitRes.data && commitRes.data.sha && commitRes.data.commit?.committer?.date) {
            latestCommitSha = commitRes.data.sha.slice(0, 7); // e.g. "abc1234"
            latestCommitDate = new Date(commitRes.data.commit.committer.date);
        }

        // 4) Compare whichever date is more recent
        if (latestReleaseDate && latestCommitDate) {
            // If both exist, pick whichever is later
            if (latestReleaseDate > latestCommitDate) {
                // release is newer => use tag
                return { type: "release", value: latestReleaseTag };
            } else {
                // commit is newer => use commit
                return { type: "commit", value: latestCommitSha };
            }
        } else if (latestReleaseDate) {
            // only release was found
            return { type: "release", value: latestReleaseTag };
        } else {
            // fallback: only commit was found
            return { type: "commit", value: latestCommitSha || "unknownSHA" };
        }
    }

    // Extract GitFingerprint from the .warperia content, if present.
    function parseGitFingerprint(warperiaContent) {
        const match = warperiaContent.match(/^GitFingerprint:\s*(.+)$/m);
        if (match) {
            return match[1].trim();
        }
        return null; // Not found
    }

    const startArtificialProgress = () => {
        // Clear any existing timer
        if (autoProgressTimer) {
            clearInterval(autoProgressTimer);
            setAutoProgressTimer(null);
        }
        // Initialize progress at 10
        setArtificialProgress(10);
        // Increment up to ~90 over time, so user sees progress moving
        const timerId = setInterval(() => {
            setArtificialProgress((prev) => {
                // If we reach 90%, stop incrementing
                if (prev >= 90) {
                    return prev;
                }
                return prev + 2; // each interval => +2%
            });
        }, 1000); // run every 1s
        setAutoProgressTimer(timerId);
    };

    const stopArtificialProgress = (finalValue = 100) => {
        if (autoProgressTimer) {
            clearInterval(autoProgressTimer);
            setAutoProgressTimer(null);
        }
        setArtificialProgress(finalValue);
    };

    async function checkIfGitHubOutdated(installedAddon) {
        const websiteLink = installedAddon.custom_fields?.website_link || "";
        if (!websiteLink.includes("github.com")) {
            // Not a GitHub addon => no check
            return false;
        }

        const localFingerprint = installedAddon.localGitFingerprint || "";
        if (!localFingerprint) {
            return false;
        }

        try {
            const githubRegex = /https?:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/|$)/;
            const match = websiteLink.match(githubRegex);
            if (!match) return false;

            const owner = match[1];
            const repo = match[2];

            const { value: remoteFingerprint } = await fetchGitHubFingerprint(
                owner,
                repo,
                GITHUB_ACCESS_TOKEN
            );

            // If no remoteFingerprint, we can't do anything
            if (!remoteFingerprint) return false;

            // Compare
            if (remoteFingerprint !== localFingerprint) {
                // Found a newer commit or release on GitHub
                return true;
            }
            return false;
        } catch (err) {
            console.error("Error checking GitHub fingerprint:", err);
            return false;
        }
    }

    // Helper function to compare addon versions so we can pick the higher one
    function semverCompare(a, b) {
        const parse = (v) => v.split(".").map(n => parseInt(n, 10) || 0);
        const [aMajor, aMinor, aPatch] = parse(a);
        const [bMajor, bMinor, bPatch] = parse(b);

        if (aMajor > bMajor) return 1;
        if (aMajor < bMajor) return -1;
        if (aMinor > bMinor) return 1;
        if (aMinor < bMinor) return -1;
        if (aPatch > bPatch) return 1;
        if (aPatch < bPatch) return -1;
        return 0;
    }

    const handleInstalarAddon = async (addon, event, isReinstall = false, skipBundledCheck = false, options = {}) => {
        const params = {
            setShowDeleteModal,
            setDeleteModalData,
            gameDir,
            semverCompare,
            showToastMessage,
            isPathInsideDirectory,
            setDescargaring,
            setInstalaringAddonId,
            setInstalaringAddonStep,
            installedComplementos,
            window,
            normalizeTitle,
            parseSerializedPHPArray,
            findChildComplementos,
            findParentComplementos,
            allComplementos,
            setProgress,
            startArtificialProgress,
            stopArtificialProgress,
            artificialProgress,
            fetchGitHubFingerprint,
            setShowModal,
            currentExpansion,
            serverId,
            setInstalaredComplementos,
            hasMultipleSubfolders,
            refreshComplementosData,
            flattenSingleExtractedFolder,
            copyFolderRecursively,
            queuedComplementos,
            ...options
        };
        return await handleAddonInstalaration(addon, event, isReinstall, skipBundledCheck, params);
    };

    const scanForInstalaredComplementos = async (gamePath) => {
        const params = {
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
        };
    
        const matchedComplementos = await checkInstalaredComplementos(gamePath, params);
        
        if (matchedComplementos) {
            setInstalaredComplementos(matchedComplementos);
        }
    };

    const handleSelectAddon = async (selectedAddon) => {
        const installPath = window.electron.pathJoin(
            gameDir,
            "Interface",
            "AddOns"
        );
        // Validate installPath
        if (!isPathInsideDirectory(installPath, gameDir)) {
            console.error("Invalid install path:", installPath);
            showToastMessage("Invalid install path.", "danger");
            return;
        }

        // Gather all folder names from similar addons to ensure proper deletion
        const allFolderNames = currentModalData.flatMap((addon) =>
            addon.custom_fields.folder_list.map(([folderName]) => folderName)
        );

        try {
            // Delete all associated folders from the conflicting addons before installing the new one
            for (const folderName of allFolderNames) {
                const folderPath = `${installPath}\\${folderName}`;
                await window.electron.deleteFolder(folderPath);
            }

            // Proceed with installing the selected addon as usual
            const addonUrl = selectedAddon.custom_fields.file;
            if (!addonUrl) {
                console.error("The source URL for this addon couldn't be found.");
                showToastMessage(
                    "The source URL for this addon couldn't be found.",
                    "danger"
                );
                return;
            }

            setDescargaring(true);
            setInstalaringAddonId(selectedAddon.id);

            const response = await axios.get(addonUrl, {
                responseType: "blob",
                onDescargarProgress: (progressEvent) => {
                    const percentCompleted = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    );
                    setProgress(percentCompleted);
                },
            });

            // Save and extract the zip
            const fileName = addonUrl.split("/").pop();
            const zipFilePath = await window.electron.saveZipFile(
                response.data,
                fileName
            );
            setInstalaringAddonStep("Extracting files");
            await window.electron.extractZip(zipFilePath, installPath);

            // Write the .warperia file to indicate the addon is installed
            const mainFolder = selectedAddon.custom_fields.folder_list.find(
                ([_, isMain]) => isMain === "1"
            )[0];
            const warperiaFilePath = `${installPath}\\${mainFolder}\\${mainFolder}.warperia`;

            await window.electron.writeFile(
                warperiaFilePath,
                `ID: ${selectedAddon.id
                }\nFolders: ${selectedAddon.custom_fields.folder_list
                    .map(([folderName]) => folderName)
                    .join(",")}`
            );
            setInstalaringAddonStep("Finalizing installation");

            // Actualizar the UI to reflect the installed addon
            const updatedComplementos = { ...installedComplementos };
            updatedComplementos[mainFolder] = selectedAddon;
            setInstalaredComplementos(updatedComplementos);

            // Process the next modal in the queue, if available
            const updatedQueue = modalQueue.slice(1);
            if (updatedQueue.length > 0) {
                setCurrentModalData(updatedQueue[0]);
                setModalQueue(updatedQueue);
            } else {
                setShowAddonSelectionModal(false);
            }

            showToastMessage(
                `"${decodeHtmlEntities(selectedAddon.title)}" installed successfully.`,
                "success"
            );
        } catch (error) {
            console.error("Error installing addon after selection:", error);
            showToastMessage(
                `Failed to install "${decodeHtmlEntities(selectedAddon.title)}".`,
                "danger"
            );
        } finally {
            setTimeout(() => {
                setDescargaring(false);
                setProgress(0);
                setInstalaringAddonId(null);
                setInstalaringAddonStep(null);
            }, 1500);
        }
    };

    const handleCancelAddonSelection = () => {
        setShowAddonSelectionModal(false);
    };

    const handleReinstallAddon = () => {
        if (contextMenu.addon) {
            handleInstalarAddon(contextMenu.addon, new Event("click"), true);
            setContextMenu({ visible: false, xPos: 0, yPos: 0, addon: null });
        }
    };

    const handleDeleteAddon = async () => {
        if (!contextMenu.addon) return;

        const mainAddon = contextMenu.addon;

        // Gather parents and sub-addons
        const parents = findParentComplementos(mainAddon, installedComplementos);
        const allSubComplementos = gatherAllSubComplementos(mainAddon, installedComplementos);
        const nestedComplementosArray = Array.from(allSubComplementos);

        // If there are parents or nested sub-addons, show the modal and RETURN
        if (parents.length > 0 || nestedComplementosArray.length > 0) {
            setDeleteModalData({
                addon: mainAddon,
                parents,
                children: nestedComplementosArray
            });
            setShowDeleteModal(true);
            return;
        }

        // If no parents or nested sub-addons, proceed with direct deletion
        try {
            const folderList = contextMenu.addon.custom_fields.folder_list || [];
            const addonFolders = await window.electron.readDir(
                `${gameDir}\\Interface\\AddOns`
            );
            const normalizedTitle = normalizeTitle(
                contextMenu.addon.custom_fields.title_toc ||
                contextMenu.addon.title ||
                ""
            );

            let foldersToDelete = [];

            for (let folder of addonFolders) {
                const tocFile = `${gameDir}\\Interface\\AddOns\\${folder}\\${folder}.toc`;

                if (await window.electron.fileExists(tocFile)) {
                    const title = await window.electron.readTitleFromToc(tocFile);
                    const normalizedFolderTitle = normalizeTitle(title || folder);

                    if (normalizedFolderTitle === normalizedTitle) {
                        foldersToDelete.push(folder);
                    }
                }
            }

            // Include any folders from the addon's folder_list
            folderList.forEach(([relatedFolder]) => {
                if (
                    !foldersToDelete.includes(relatedFolder) &&
                    addonFolders.includes(relatedFolder)
                ) {
                    foldersToDelete.push(relatedFolder);
                }
            });

            if (foldersToDelete.length > 0) {
                for (const folder of foldersToDelete) {
                    const addonFolder = `${gameDir}\\Interface\\AddOns\\${folder}`;
                    await window.electron.deleteFolder(addonFolder);
                }

                showToastMessage(
                    `"${decodeHtmlEntities(
                        contextMenu.addon.title
                    )}" and related folders deleted successfully.`,
                    "success"
                );
                await scanForInstalaredComplementos(gameDir);
                await updateAddonUninstallStats(
                    contextMenu.addon.id,
                    contextMenu.addon.post_type
                );
            } else {
                showToastMessage(
                    `Failed to find folders for "${decodeHtmlEntities(
                        contextMenu.addon.title
                    )}".`,
                    "danger"
                );
            }
        } catch (error) {
            console.error("Error deleting addon:", error);
            showToastMessage(
                `Failed to delete "${decodeHtmlEntities(contextMenu.addon.title)}".`,
                "danger"
            );
        }
    };

    // Confirm addon deletion for bundles (dependencies)
    async function confirmDeleteComplementos(selectedSubAddonIds) {
        const originalAddonId = installingAddonId;
        const mainAddon = deleteModalData.addon;
        const targetAddon = deleteModalData.newAddon;
        if (!mainAddon) return;

        // Reset state immediately before installation
        setDescargaring(false);
        setProgress(0);
        setInstalaringAddonId(null);
        setShowDeleteModal(false);

        if (targetAddon) {
            await handleInstalarAddon(targetAddon, new Event("click"), true, true);
        }

        if (originalAddonId) {
            const addonToInstalar = allComplementos.find(a => a.id === originalAddonId);
            if (addonToInstalar) {
                await handleInstalarAddon(addonToInstalar, new Event("click"), true, true);
            }
        }

        try {
            // Get target variation from modal data
            const targetVariation = deleteModalData.newAddon;

            // Instalar the new variation AFTER confirmation
            if (targetVariation) {
                await handleInstalarAddon(targetVariation, new Event("click"), true, true);
            }

            // Build the set of addon IDs we are actually deleting
            const allToDelete = new Set([mainAddon.id, ...selectedSubAddonIds]);

            // Which installedComplementos match that set?
            const addonsToDelete = Object.values(installedComplementos).filter(
                (a) => allToDelete.has(a.id)
            );

            // Get quick access to all installed addons by their main folder
            // so we can detect if we're about to remove the main folder of an addon the user wants to keep
            const mainFolderMap = {};
            for (const candidate of Object.values(installedComplementos)) {
                // Each installed addon might have a main folder
                const mainFolderEntry = candidate.custom_fields?.folder_list?.find(
                    ([_, isMain]) => isMain === "1"
                );
                if (mainFolderEntry) {
                    const [candidateMainFolder] = mainFolderEntry;
                    mainFolderMap[candidateMainFolder] = candidate.id;
                }
            }

            // Read all current folders once
            const addonFolders = await window.electron.readDir(`${gameDir}\\Interface\\AddOns`);

            // For each addon we *are* deleting, remove its matching folders
            for (const ad of addonsToDelete) {
                const folderList = ad.custom_fields.folder_list || [];
                const normalizedTitle = normalizeTitle(
                    ad.custom_fields.title_toc || ad.title || ""
                );

                let foldersToDelete = [];

                // Attempt to match by .toc name
                for (const folder of addonFolders) {
                    const tocFile = `${gameDir}\\Interface\\AddOns\\${folder}\\${folder}.toc`;
                    if (await window.electron.fileExists(tocFile)) {
                        const title = await window.electron.readTitleFromToc(tocFile);
                        const normalizedFolderTitle = normalizeTitle(title || folder);
                        if (normalizedFolderTitle === normalizedTitle) {
                            foldersToDelete.push(folder);
                        }
                    }
                }

                // Include any folders from the addon's folder_list
                folderList.forEach(([relatedFolder]) => {
                    if (!foldersToDelete.includes(relatedFolder) && addonFolders.includes(relatedFolder)) {
                        foldersToDelete.push(relatedFolder);
                    }
                });

                // Before removing each folder, skip it if it's the main folder of a sub‐addon the user *didn't* select for deletion
                foldersToDelete = foldersToDelete.filter((folderName) => {
                    const possibleSubAddonId = mainFolderMap[folderName];
                    // If this folder is *not* someone's main folder, we can safely remove it
                    if (!possibleSubAddonId) return true;

                    // If it *is* someone's main folder but that sub‐addon is also in allToDelete, it's OK to remove
                    if (allToDelete.has(possibleSubAddonId)) return true;

                    // Otherwise, skip removing this folder because that sub‐addon was kept
                    return false;
                });

                // Actually remove them
                for (const folderName of foldersToDelete) {
                    const folderPath = `${gameDir}\\Interface\\AddOns\\${folderName}`;
                    await window.electron.deleteFolder(folderPath);
                }
            }

            showToastMessage(`Correctofully deleted addon(s).`, "success");
            await scanForInstalaredComplementos(gameDir);

            // If this was triggered during an installation, proceed with the installation
            if (installingAddonId) {
                const addonToInstalar = allComplementos.find(a => a.id === installingAddonId);
                if (addonToInstalar) {
                    await handleInstalarAddon(addonToInstalar, new Event("click"), true, true);
                }
            }
        } catch (error) {
            console.error("Error deleting addon(s):", error);
            showToastMessage("Failed to delete addon(s).", "danger");
        }
    }

    // Unserialize the JSON code for the addon variations
    const parseSerializedPHPArray = (serializedData) => {
        if (!serializedData) return [];

        // Handle direct arrays
        if (Array.isArray(serializedData)) return serializedData;

        // Handle PHP-serialized strings
        const regex = /i:\d+;i:(\d+);/g;
        const matches = [];
        let match;
        while ((match = regex.exec(serializedData)) !== null) {
            matches.push(match[1]);
        }
        return matches;
    };

    const openSwitchVariationModal = async (addon) => {
        try {
            setCurrentAddon(addon);
            setShowSwitchModal(true);
            setLoadingVariations(true);

            let mainAddon = addon;
            let variationIds = [];

            // Check if this addon is a variation
            if (
                addon.custom_fields?.variation &&
                addon.custom_fields.variation !== "0" &&
                addon.custom_fields.variation !== ""
            ) {
                // Fetch the main addon if this is a variation
                const response = await axios.get(
                    `${WEB_URL}/wp-json/wp/v2/${currentExpansion}-addons/${addon.custom_fields.variation}`
                );
                mainAddon = response.data;
            }

            // Add the main addon to the variations list
            const variations = [mainAddon];

            // Get variation IDs from the main addon
            const variationIdsArray = mainAddon.custom_fields?.has_variations || [];
            if (Array.isArray(variationIdsArray) && variationIdsArray.length > 0) {
                variationIds = variationIdsArray;
            }

            // Fetch the variations from the API
            for (const variationId of variationIds) {
                const response = await axios.get(
                    `${WEB_URL}/wp-json/wp/v2/${currentExpansion}-addons/${variationId}`
                );
                variations.push(response.data);
            }

            // Set available variations (parent + variations)
            setAvailableVariations(variations);
        } catch (error) {
            console.error("Error fetching variations:", error);
            showToastMessage("Failed to load variations.", "danger");
        } finally {
            setLoadingVariations(false);
        }
    };

    const handleSwitchVariation = async (newVariation) => {
        if (!currentAddon) return;

        const bundledComplementos = findChildComplementos(currentAddon, installedComplementos);

        if (bundledComplementos.length > 0) {
            // Show delete confirmation first
            setDeleteModalData({
                addon: currentAddon,
                newAddon: newVariation, // Store target variation
                parents: [],
                children: bundledComplementos,
                isInstalaration: true
            });
            setShowDeleteModal(true);
            return; // Stop here until confirmation
        }

        try {
            // Delete the currently installed folders
            const installedFolders = currentAddon.custom_fields.folder_list.map(
                ([folderName]) => folderName
            );
            for (const folder of installedFolders) {
                const folderPath = window.electron.pathJoin(
                    gameDir,
                    "Interface",
                    "AddOns",
                    folder
                );
                await window.electron.deleteFolder(folderPath);
            }

            // Instalar the new variation
            await handleInstalarAddon(newVariation, new Event("click"));

            // Actualizar UI
            showToastMessage(
                `Switched to variation: ${newVariation.title}`,
                "success"
            );
            setShowSwitchModal(false);
            await scanForInstalaredComplementos(gameDir);
        } catch (error) {
            console.error("Error switching variations:", error);
            showToastMessage("Failed to switch variations.", "danger");
        }
    };

    const openExportModal = () => setShowExportModal(true);
    const openImportModal = () => setShowImportModal(true);

    const closeExportModal = () => setShowExportModal(false);
    const closeImportModal = () => setShowImportModal(false);

    const handleImportComplementos = async (addonIds) => {
        try {
            for (const id of addonIds) {
                const addon = await axios.get(
                    `${WEB_URL}/wp-json/wp/v2/${currentExpansion}-addons/${id}`
                );
                await handleInstalarAddon(addon.data, new Event("click"));
            }
            showToastMessage("Complementos imported successfully!", "success");
        } catch (error) {
            showToastMessage(
                "Failed to import addons. Invalid export code.",
                "danger"
            );
        }
    };

    const handleActualizarAddon = async (addon, skipActualizar = false) => {
        try {
            const installPath = `${gameDir}\\Interface\\AddOns`;

            // Identify main folder from the addon’s folder_list
            const mainFolder = addon.custom_fields.folder_list.find(
                ([_, isMain]) => isMain === "1"
            )[0];
            const mainFolderPath = `${installPath}\\${mainFolder}`;
            const tocFilePath = `${mainFolderPath}\\${mainFolder}.toc`;
            const warperiaFilePath = `${mainFolderPath}\\${mainFolder}.warperia`;

            // 1) Local .toc version + local .warperia data
            const currentVersion = await window.electron.readVersionFromToc(tocFilePath) || "1.0.0";
            let storedFilename = "";
            let localGitFingerprint = "";
            let localWordPressVersion = "";

            if (await window.electron.fileExists(warperiaFilePath)) {
                const warperiaContent = await window.electron.readFile(warperiaFilePath);

                // Filename
                const filenameMatch = warperiaContent.match(/^Filename:\s*(.+)$/m);
                if (filenameMatch) {
                    storedFilename = filenameMatch[1].trim();
                }

                // GitFingerprint
                const gitMatch = warperiaContent.match(/^GitFingerprint:\s*(.+)$/m);
                if (gitMatch) localGitFingerprint = gitMatch[1].trim();

                // WordPressVersion
                const wpMatch = warperiaContent.match(/^WordPressVersion:\s*(.+)$/m);
                if (wpMatch) localWordPressVersion = wpMatch[1].trim();
            }

            // 2) The current backend data
            const backendVersion = addon.custom_fields.version || "1.0.0";
            const currentFilename = addon.custom_fields.file.split("/").pop();
            const currentBackendFilename = addon.custom_fields.file.split('/').pop();

            // 3) Check “Warperia-TDLO-based” differences
            let versionCompareResult = semverCompare(backendVersion, localWordPressVersion);
            let versionIsOutdated = (versionCompareResult > 0); // only if backend > local

            let filenameIsOutdated = (
                storedFilename !== currentFilename ||
                storedFilename !== currentBackendFilename
            );

            let warperiaOutOfDate = versionIsOutdated || filenameIsOutdated;

            // 4) Check if GitHub-based
            const isGitHubAddon =
                addon.custom_fields.website_link?.includes("github.com") &&
                localGitFingerprint; // we already have a local fingerprint

            let remoteFingerprint = "";
            let githubOutOfDate = false;
            if (isGitHubAddon) {
                try {
                    // fetch GitHub's latest commit or release
                    const githubRegex = /https?:\/\/github\.com\/([^/]+)\/([^/]+)(?:\/|$)/;
                    const match = addon.custom_fields.website_link.match(githubRegex);
                    if (match) {
                        const owner = match[1];
                        const repo = match[2];
                        const { value } = await fetchGitHubFingerprint(owner, repo, GITHUB_ACCESS_TOKEN);
                        remoteFingerprint = value;
                        githubOutOfDate = (remoteFingerprint && remoteFingerprint !== localGitFingerprint);
                    }
                } catch (err) {
                    console.warn("Could not fetch GitHub fingerprint:", err);
                }
            }

            // 5) If EITHER the Warperia-TDLO-based checks or the GitHub-based check is true => needs update
            const needsActualizar = warperiaOutOfDate || githubOutOfDate;

            if (needsActualizar) {
                // 6) We’ll bump the .toc version to match the latest backendVersion
                await window.electron.updateTocVersion(mainFolderPath, backendVersion);

                // 7) Rebuild .warperia with everything (Filename, WordPressVersion, GitFingerprint if any)
                let newWarperia-TDLOContent = `ID: ${addon.id}
    Folders: ${addon.custom_fields.folder_list
                        .map(([folderName]) => folderName)
                        .join(",")}
    Filename: ${currentFilename}
    WordPressVersion: ${backendVersion}`;

                let finalFingerprint = localGitFingerprint;
                if (remoteFingerprint) {
                    finalFingerprint = remoteFingerprint;
                }
                if (finalFingerprint) {
                    newWarperia-TDLOContent += `\nGitFingerprint: ${finalFingerprint}`;
                }

                await window.electron.writeFile(warperiaFilePath, newWarperia-TDLOContent);

                // 8) Now do the usual reinstall
                await handleInstalarAddon(addon, new Event("click"), true, false, {
                    skipActualizar: skipActualizar
                });    

            } else {
                showToastMessage(
                    `The addon is already up-to-date: v${currentVersion}`,
                    "info"
                );
            }

        } catch (error) {
            console.error(`Error updating addon "${addon.title}":`, error);
            showToastMessage(`Failed to update "${addon.title}".`, "danger");
        }
    };

    const handleActualizarAllComplementos = async () => {
        try {
            // 1) Gather all addons needing update
            const addonsToActualizar = Object.values(installedComplementos).filter((addon) => {
                // Local vs. backend versions
                const installedVersion = addon.localVersion || "0.0.0";
                const backendVersion = addon.custom_fields?.version || "0.0.0";
                // Compare semver => if backend > local => versionIsOutdated
                const versionCompare = semverCompare(backendVersion, installedVersion);
                const versionIsOutdated = versionCompare > 0;

                // Filenames
                const currentFilename = (addon.custom_fields?.file || "").split("/").pop();
                const storedFilename = addon.storedFilename || "";
                const fileIsOutdated = !!(storedFilename && currentFilename && storedFilename !== currentFilename);

                // GitHub or corrupted flags
                const hasGitHubActualizar = !!addon.gitNeedsActualizar;
                const isCorrupted = !!addon.corrupted;

                // If ANY are true => we consider it needing an update
                return (versionIsOutdated || fileIsOutdated || hasGitHubActualizar || isCorrupted);
            });

            // 2) If none need updating, bail out
            if (addonsToActualizar.length === 0) {
                showToastMessage("No addons need updating.", "info");
                return;
            }

            // 3) Mark we're downloading and set the queue
            setDescargaring(true);
            setQueuedComplementos(addonsToActualizar.map(addon => addon.id));

            // 4) Actualizar each addon that requires an update
            for (let i = 0; i < addonsToActualizar.length; i++) {
                const addon = addonsToActualizar[i];
                setInstalaringAddonId(addon.id);
                await handleActualizarAddon(addon, true);
                setQueuedComplementos(prev => prev.filter(id => id !== addon.id));
            }

            // 5) Correcto message + refresh
            await refreshComplementosData();
            showToastMessage("All addons updated successfully.", "success");
            await scanForInstalaredComplementos(gameDir);  // Re-scan installed addons
        } catch (error) {
            console.error("Error updating all addons:", error);
            showToastMessage("Failed to update all addons.", "danger");
        } finally {
            setDescargaring(false);
            setInstalaringAddonId(null);
            setQueuedComplementos([]);
        }
    };

    const showToastMessage = useCallback((message, type) => {
        const uniqueId = `${Date.now()}-${Math.random()}`;
        const newToast = { id: uniqueId, message, type };
        setToasts((prevToasts) => [...prevToasts, newToast]);

        setTimeout(() => {
            setToasts((prevToasts) =>
                prevToasts.filter((toast) => toast.id !== uniqueId)
            );
        }, 5000);
    }, []);

    const handleOpenAddonFolder = async (addon, folderName) => {
        try {
            if (!gameDir) {
                showToastMessage("Your game directory is not configured.", "danger");
                return;
            }

            // Construct full path
            const absoluteGameDir = window.electron.pathResolve(gameDir);
            const folderPath = window.electron.pathJoin(
                absoluteGameDir,
                "Interface",
                "AddOns",
                folderName
            );

            // Simple security check to ensure it's inside AddOns folder
            if (!isPathInsideDirectory(folderPath, absoluteGameDir)) {
                showToastMessage("Invalid folder path.", "danger");
                return;
            }

            // Invoke the IPC method in main.cjs to open the folder
            await window.electron.ipcRenderer.invoke('open-directory', folderPath);

        } catch (error) {
            console.error('Error opening addon folder:', error);
            showToastMessage("Failed to open folder.", "danger");
        }
    };

    const handleRightClick = (event, addon) => {
        event.preventDefault();

        const normalizedTitle = normalizeTitle(
            addon?.custom_fields.title_toc || addon.title || ""
        );

        // Check if the addon is installed by looking at installedComplementos
        const isInstalared = Object.values(installedComplementos).some(
            (installedAddon) => {
                const normalizedInstalaredTitle = normalizeTitle(
                    installedAddon?.title || ""
                );
                const normalizedInstalaredTocTitle = normalizeTitle(
                    installedAddon?.custom_fields?.title_toc || ""
                );

                return (
                    normalizedInstalaredTitle === normalizedTitle ||
                    normalizedInstalaredTocTitle === normalizedTitle
                );
            }
        );

        // Grab folder list directly from the addon 
        const folderList = addon?.custom_fields?.folder_list || [];

        setContextMenu({
            visible: true,
            xPos: event.pageX,
            yPos: event.pageY,
            addon,
            isInstalared,
            addonImage: addon.featured_image ?? 'public/default-image.jpg',
            addonName: addon.title,
            folderList
        });
    };

    const handleClickOutside = () => {
        setContextMenu({ visible: false, xPos: 0, yPos: 0, addon: null });
    };

    const handleReportAddon = () => {
        if (contextMenu.addon) {
            setCurrentAddonForReport(contextMenu.addon);
            setShowReportModal(true);
        }
    };

    const handleReportSubmit = async (details) => {
        if (!currentAddonForReport) return;

        try {
            const reportData = {
                title: `Report for Addon: ${currentAddonForReport.title}`,
                content: details,
                meta: {
                    addon_id: currentAddonForReport.id,
                    addon_name: currentAddonForReport.title,
                    addon_report_expansion: currentAddonForReport.post_type,
                    post_type: currentAddonForReport.post_type,
                    author_username: user?.username || "",
                },
            };

            const tokenResult = await window.electron.retrieveToken();
            if (tokenResult.success && tokenResult.token) {
                await axios.post(`${WEB_URL}/wp-json/wp/v2/addon-reports`, reportData, {
                    headers: {
                        Authorization: `Bearer ${tokenResult.token}`,
                    },
                });

                showToastMessage("Report submitted successfully.", "success");
            } else {
                showToastMessage("Failed to authenticate. Please try again.", "danger");
            }
        } catch (error) {
            console.error("Error submitting report:", error);
            showToastMessage("Failed to submit report.", "danger");
        } finally {
            setShowReportModal(false);
        }
    };

    // View addon on the website
    const handleViewOnWarperia-TDLO = (addon) => {
        if (!addon) return;

        // Construct the URL for the addon on the backend website
        const addonUrl = `${addon.link}`;

        // Open the URL in the default browser using window.open
        window.open(addonUrl, '_blank');
    };

    useEffect(() => {
        document.addEventListener("click", handleClickOutside);
        return () => {
            document.removeEventListener("click", handleClickOutside);
        };
    }, []);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPreviousPage(currentPage); // Store the current page before changing
            setCurrentPage(newPage);
        }
    };

    const handleJumpToPage = (event) => {
        const pageNumber = parseInt(event.target.value, 10);
        if (!isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
        }
    };

    // Post type to version mapping
    const postTypeVersionMap = {
        "addon-vanilla": "1.12.1",
        "addon-tbc": "2.4.3",
        "addon-wotlk": "3.3.5",
        "addon-cata": "4.3.4",
        "addon-mop": "5.4.8",
    };

    // Render the list of addons
    const renderComplementosList = (addonsList) => {
        const combinedComplementosList =
            activeTab === "myComplementos"
                ? { ...installedComplementos, ...corruptedComplementos }
                : addonsList;

        const uniqueComplementos = Object.values(combinedComplementosList).reduce(
            (acc, addon) => {
                if (!acc.some((existingAddon) => existingAddon.id === addon.id)) {
                    acc.push(addon);
                }
                return acc;
            },
            []
        );

        // Sort addons needing updates to the top
        const sortedComplementos = uniqueComplementos.sort((a, b) => {
            // 1) Local versions
            const aLocalVersion = a.localVersion || "0.0.0";
            const bLocalVersion = b.localVersion || "0.0.0";

            // 2) Backend versions
            const aBackendVersion = a.custom_fields?.version || "0.0.0";
            const bBackendVersion = b.custom_fields?.version || "0.0.0";

            // 3) Filenames
            const aBackendFilename = a.custom_fields?.file?.split("/")?.pop() || "";
            const bBackendFilename = b.custom_fields?.file?.split("/")?.pop() || "";
            const aLocalFilename = a.storedFilename || "";
            const bLocalFilename = b.storedFilename || "";

            // 4) Helper: does addon need an update?
            const needsActualizar = (addon, localVer, backendVer, localFile, backendFile) => {
                // Compare versions: if backendVer is strictly greater => out of date
                const verCompare = semverCompare(backendVer, localVer);
                const versionIsOutdated = (verCompare > 0); // only if backend > local

                // Compare filenames
                const fileIsOutdated = !!(localFile && backendFile && localFile !== backendFile);

                // Or the addon might be flagged as corrupted
                const isCorrupted = !!addon.corrupted;

                // If ANY are true => needs update
                return versionIsOutdated || fileIsOutdated || isCorrupted;
            };

            // 5) Evaluate for a and b
            const aNeedsActualizar = needsActualizar(a, aLocalVersion, aBackendVersion, aLocalFilename, aBackendFilename);
            const bNeedsActualizar = needsActualizar(b, bLocalVersion, bBackendVersion, bLocalFilename, bBackendFilename);

            // 6) Sort so that those needing an update appear at the top
            if (aNeedsActualizar && !bNeedsActualizar) return -1;   // a first
            if (!aNeedsActualizar && bNeedsActualizar) return 1;    // b first
            return 0; // otherwise, keep them in normal order
        });

        let finalComplementos = sortedComplementos;

        if (activeTab === "myComplementos") {
            // Apply filtering if user typed something in the installed search
            if (installedBuscarQuery && installedBuscarQuery.trim().length > 0) {
                const searchTerm = installedBuscarQuery.toLowerCase();

                finalComplementos = finalComplementos.filter((addon) => {
                    const rawTitle = addon.title || addon.custom_fields?.title_toc || "";
                    const addonTitle = decodeHtmlEntities(rawTitle).toLowerCase();
                    return addonTitle.includes(searchTerm);
                });
            }
        }

        if (activeTab === "myComplementos") {
            return (
                <div className="table-responsive">
                    <table className="table table-addons-installed align-middle user-select-none mb-0">
                        <thead>
                            <tr>
                                <th scope="col">Name</th>
                                <th scope="col">Status</th>
                                <th scope="col">Game Version</th>
                                <th scope="col">Creator</th>
                            </tr>
                        </thead>
                        <tbody>
                            {finalComplementos.length === 0 && installedBuscarQuery.trim().length > 0 ? (
                                <tr>
                                    <td colSpan="5" className="text-center text-muted">
                                        No results found for "{installedBuscarQuery}".
                                    </td>
                                </tr>
                            ) : (
                                finalComplementos.map((addon) => {
                                    const installedAddon =
                                        Object.values(installedComplementos).find((installed) => installed.id === addon.id) || addon;
                                    const installedVersion = installedAddon.localVersion || "N/A";
                                    const addonImage = installedAddon.featured_image
                                        ? installedAddon.featured_image
                                        : "public/default-image.jpg";

                                    const postType = installedAddon.post_type || currentExpansion;
                                    const gameVersion = postTypeVersionMap[postType] || postType;

                                    // Figure out child addons
                                    const childComplementos = findChildComplementos(installedAddon, installedComplementos);
                                    const isExpanded = expandedComplementos.includes(installedAddon.id);

                                    // 1) Grab local vs. backend versions
                                    const localVersion = installedAddon.localVersion || "0.0.0";
                                    const backendVersion = installedAddon.custom_fields?.version || "0.0.0";
                                    const verCompare = semverCompare(backendVersion, localVersion);
                                    const versionIsOutdated = (verCompare > 0); // Only "outdated" if backend > local

                                    // 2) Check filenames
                                    const localFile = installedAddon.storedFilename || "";
                                    const backendFile = installedAddon.custom_fields?.file?.split("/")?.pop() || "";
                                    const fileIsOutdated = !!(localFile && backendFile && localFile !== backendFile);

                                    // 3) Check corruption or GitHub update flags
                                    const isCorrupted = !!installedAddon.corrupted;
                                    const hasGitHubActualizar = !!installedAddon.gitNeedsActualizar;

                                    // 4) Combine them
                                    const finalNeedsActualizar = versionIsOutdated || fileIsOutdated || isCorrupted || hasGitHubActualizar;

                                    // Build statusContent
                                    let statusContent;
                                    if (finalNeedsActualizar && !queuedComplementos.includes(installedAddon.id) && 
                                        !downloading && installingAddonId !== installedAddon.id) {
                                        // Only show Actualizar button if it truly needs update and is not in queue
                                        statusContent = (
                                            <button
                                                className="btn btn-primary"
                                                onClick={(e) => handleInstalarAddon(installedAddon, e, true)}
                                                disabled={downloading}
                                            >
                                                Actualizar
                                            </button>
                                        );
                                    } else if (queuedComplementos.includes(installedAddon.id) && installingAddonId !== installedAddon.id) {
                                        // Show queued status
                                        statusContent = (
                                            <Tippy
                                                content="This addon is queued for update"
                                                placement="auto"
                                                className="custom-tooltip"
                                            >
                                                <span className="text-muted fw-medium">
                                                    <i className="bi bi-hourglass-split text-warning me-1"></i> Queued
                                                </span>
                                            </Tippy>
                                        );
                                    } else if (downloading && installingAddonId === installedAddon.id) {
                                        // Show updating status
                                        statusContent = (
                                            <span className="text-muted fw-medium">
                                                <span
                                                    className="spinner-border spinner-border-sm me-1"
                                                    role="status"
                                                    aria-hidden="true"
                                                ></span>
                                                Updating...
                                            </span>
                                        );
                                    } else {
                                        // Show updated status with green checkmark
                                        statusContent = (
                                            <Tippy
                                                content="You have the latest version installed"
                                                placement="auto"
                                                className="custom-tooltip"
                                            >
                                                <span className="text-muted fw-medium">
                                                    <i className="bi bi-check-circle-fill text-success me-1"></i> Actualizard
                                                </span>
                                            </Tippy>
                                        );
                                    }

                                    return (
                                        <React.Fragment key={installedAddon.id}>
                                            <tr
                                                onContextMenu={(e) => handleRightClick(e, installedAddon)}
                                                onClick={() => handleViewAddon(installedAddon)}
                                                style={{ cursor: "pointer" }}
                                            >
                                                <td>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <img
                                                            src={addonImage}
                                                            alt={installedAddon.title}
                                                            className="img-fluid rounded"
                                                            style={{
                                                                width: "60px",
                                                                height: "60px",
                                                                objectFit: "cover",
                                                            }}
                                                            onContextMenu={(e) => handleRightClick(e, installedAddon)}
                                                        />

                                                        <div>
                                                            <div className="fw-medium">
                                                                {decodeHtmlEntities(installedAddon.title)}
                                                                {downloading && installingAddonId === addon.id && (
                                                                    <div
                                                                        className="spinner-border spinner-addon-title ms-2 text-muted"
                                                                        role="status"
                                                                    >
                                                                        <span className="visually-hidden">Loading...</span>
                                                                    </div>
                                                                )}
                                                                {childComplementos.length > 0 && (
                                                                    <Tippy
                                                                        content="Show dependencies"
                                                                        placement="auto"
                                                                        className="custom-tooltip"
                                                                    >
                                                                        <i
                                                                            className={`bi ${isExpanded ? "bi-chevron-up" : "bi-chevron-down"
                                                                                } text-muted ms-2 accordion-button rounded`}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                toggleAddonExpansion(installedAddon.id);
                                                                            }}
                                                                        />
                                                                    </Tippy>
                                                                )}
                                                            </div>
                                                            <div
                                                                className="text-muted fw-medium"
                                                                style={{ fontSize: "0.9rem" }}
                                                            >
                                                                {/* Variation switch UI if needed */}
                                                                <Tippy
                                                                    content="Instalared version"
                                                                    placement="auto"
                                                                    className="custom-tooltip"
                                                                >
                                                                    <span>{installedVersion}</span>
                                                                </Tippy>
                                                                {((Array.isArray(addon.custom_fields?.has_variations) &&
                                                                    addon.custom_fields.has_variations.length > 0) ||
                                                                    (addon.custom_fields?.variation &&
                                                                        addon.custom_fields.variation !== "" &&
                                                                        addon.custom_fields.variation !== "0")) && (
                                                                        <Tippy
                                                                            content="Switch Addon Variation"
                                                                            placement="top"
                                                                            className="custom-tooltip"
                                                                        >
                                                                            <div
                                                                                className="btn btn-link"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    openSwitchVariationModal(addon);
                                                                                }}
                                                                            >
                                                                                <i className="bi bi-arrow-left-right text-primary me-1"></i>{" "}
                                                                                Switch
                                                                            </div>
                                                                        </Tippy>
                                                                    )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>{statusContent}</td>
                                                <td className="text-muted fw-medium">{gameVersion}</td>
                                                <td className="text-muted fw-medium">
                                                    {renderAddonAuthor(installedAddon, true)}
                                                </td>
                                            </tr>

                                            {/* Accordion row for sub‐addons */}
                                            {childComplementos.length > 0 && isExpanded && (
                                                <tr>
                                                    <td colSpan={5} style={{ background: "#1b1b1b" }}>
                                                        <div className="p-3">
                                                            <div className="text-muted mb-2">
                                                                <small>
                                                                    The following addon(s) are bundled or dependencies of{" "}
                                                                    <strong>{decodeHtmlEntities(installedAddon.title)}</strong>:
                                                                </small>
                                                            </div>
                                                            <table className="table table-sm table-dark-subaddons mb-0">
                                                                <tbody>
                                                                    {childComplementos.map((child) => {
                                                                        const childImage = child.featured_image || "public/default-image.jpg";

                                                                        return (
                                                                            <tr
                                                                                key={child.id}
                                                                                style={{ cursor: "pointer" }}
                                                                                onClick={() => handleViewAddon(child)}
                                                                                onContextMenu={(e) => handleRightClick(e, child)}
                                                                            >
                                                                                <td>
                                                                                    <div className="d-flex align-items-center gap-2">
                                                                                        <img
                                                                                            src={childImage}
                                                                                            alt={child.title}
                                                                                            className="img-fluid rounded"
                                                                                            style={{
                                                                                                width: "40px",
                                                                                                height: "40px",
                                                                                                objectFit: "cover",
                                                                                            }}
                                                                                        />
                                                                                        <div>
                                                                                            <div className="d-block" style={{ fontSize: "0.95rem" }}>
                                                                                                {decodeHtmlEntities(child.title)}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            );
        }

        // Browse Complementos
        return (
            <div
                className={`row ${activeTab === "myComplementos" ? "g-4" : "g-3 row-cols-md-1 row-cols-xl-1"
                    }`}
            >
                {finalComplementos.map((addon) => {
                    const installedAddon = Object.values(installedComplementos).find(
                        (installed) => installed.id === addon.id
                    );

                    return (
                        <BrowseAddonCard
                            key={addon.id}
                            addon={addon}
                            installedAddon={installedAddon}
                            downloading={downloading}
                            installingAddonId={installingAddonId}
                            installingAddonStep={installingAddonStep}
                            progress={progress}
                            handleInstalarAddon={handleInstalarAddon}
                            handleActualizarAddon={handleActualizarAddon}
                            handleRightClick={handleRightClick}
                            renderAddonAuthor={renderAddonAuthor}
                            handleViewAddon={handleViewAddon}
                        />
                    );
                })}
            </div>
        );
    };

    return (
        <div>
            <div className="container position-relative" ref={containerRef}>
                {settings &&
                    settings.enable_ads_banner_top === 1 &&
                    settings.app_ads_image_banner_top && (
                        <section className="container py-3 text-center">
                            <img
                                src={settings.app_ads_image_banner_top}
                                alt="Top Banner Ad"
                                className="img-fluid"
                                draggable="false"
                                style={{ maxHeight: "150px", objectFit: "contain" }}
                            />
                        </section>
                    )}
                <div ref={mainHeaderRef} className="tab-content" id="addonTabsContent">
                    <div
                        className={`tab-pane fade ${activeTab === "myComplementos" ? "show active" : ""
                            }`}
                        id="my-addons"
                        role="tabpanel"
                        aria-labelledby="my-addons-tab"
                    >
                        <div className="d-flex mb-3 sticky-top sticky-controls pt-2">
                            <div className="w-100 d-flex flex-wrap align-items-center gap-2">
                                <Tippy content="Actualizar all addons" placement="auto">
                                    <span>
                                    <button
                                            className="btn btn-primary"
                                            onClick={handleActualizarAllComplementos}
                                            disabled={
                                                Object.values(installedComplementos)
                                                    .filter((addon) => {
                                                        const installedVersion = addon.localVersion || "0.0.0";
                                                        const backendVersion = addon.custom_fields.version || "0.0.0";
                                                        const versionIsOutdated = semverCompare(backendVersion, installedVersion) > 0;

                                                        const currentFilename = addon.custom_fields.file.split("/").pop();
                                                        const storedFilename = addon.storedFilename || "";
                                                        const fileIsOutdated = storedFilename && storedFilename !== currentFilename;

                                                        const isCorrupted = !!addon.corrupted;
                                                        const hasGitHubActualizar = !!addon.gitNeedsActualizar;

                                                        return (
                                                            versionIsOutdated ||
                                                            fileIsOutdated ||
                                                            isCorrupted ||
                                                            hasGitHubActualizar
                                                        );
                                                    })
                                                    .length === 0
                                                || downloading
                                                || queuedComplementos.length > 0
                                            }
                                        >
                                            {downloading ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
                                                    Updating...
                                                </>
                                            ) : (
                                                "Actualizar All"
                                            )}
                                        </button>

                                    </span>
                                </Tippy>
                                <div className="ms-auto d-flex gap-2">
                                    <div className="searchbar-addons-installed position-relative">
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Buscar..."
                                            value={installedBuscarQuery}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setInstalaredBuscarQuery(val);
                                            }}
                                        />
                                        <i className="bi bi-search position-absolute text-muted pe-none"></i>
                                    </div>
                                    <div className="dropdown">
                                        <button
                                            className="btn btn-secondary"
                                            type="button"
                                            id="exportImportDropdown"
                                            data-bs-toggle="dropdown"
                                            aria-expanded="false"
                                        >
                                            <i className="bi bi-copy me-1"></i> Sharing
                                        </button>
                                        <ul
                                            className="dropdown-menu dropdown-custom-dark"
                                            aria-labelledby="exportImportDropdown"
                                        >
                                            <li>
                                                <button
                                                    className="dropdown-item py-2"
                                                    onClick={openExportModal}
                                                >
                                                    Export Complementos
                                                </button>
                                            </li>
                                            <li>
                                                <button
                                                    className="dropdown-item py-2"
                                                    onClick={openImportModal}
                                                >
                                                    Import Complementos
                                                </button>
                                            </li>
                                        </ul>
                                    </div>
                                    <Tippy content="Actualizar your addons" placement="auto">
                                        <button
                                            className="btn btn-secondary"
                                            onClick={refreshComplementosData}
                                        >
                                            <i className="bi bi-arrow-clockwise me-1" style={{ verticalAlign: '-1px' }}></i> Actualizar
                                        </button>
                                    </Tippy>
                                </div>
                            </div>
                        </div>
                        {initialLoading || scanningComplementos ? (
                            <div className="text-center my-4">
                                <div className="spinner-border" role="status">
                                    <span className="visually-hidden">Scanning Complementos...</span>
                                </div>
                            </div>
                        ) : (
                            <>
                                {Object.keys(installedComplementos).length === 0 ? (
                                    <div className="text-muted my-4">
                                        <p>We couldn't find any addons.</p>
                                    </div>
                                ) : (
                                    <>
                                        {renderComplementosList(
                                            Object.values(installedComplementos)
                                                .map((installedAddon) => {
                                                    const matchedAddon = addons.find(
                                                        (addon) =>
                                                            normalizeTitle(addon.title) === normalizeTitle(installedAddon.title) ||
                                                            normalizeTitle(addon.custom_fields.title_toc) === normalizeTitle(installedAddon.title)
                                                    );
                                                    return matchedAddon ? matchedAddon : installedAddon;
                                                })
                                                .filter((addon) => {
                                                    // If user has typed at least 3 characters, filter results
                                                    if (installedBuscarQuery && installedBuscarQuery.length >= 3) {
                                                        const searchTerm = installedBuscarQuery.toLowerCase();
                                                        const addonTitle = decodeHtmlEntities(addon.title).toLowerCase();
                                                        return addonTitle.includes(searchTerm);
                                                    }
                                                    // If search query is empty or less than 3 characters, show all
                                                    return true;
                                                })
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                    <div
                        className={`tab-pane fade ${activeTab === "browseComplementos" ? "show active" : ""
                            }`}
                        id="browse-addons"
                        role="tabpanel"
                        aria-labelledby="browse-addons-tab"
                    >
                        <div className="row justify-content-between gy-2 mb-4 sticky-top sticky-controls pt-2">
                            <div className="col-12 col-md-8">
                                <div className="searchbar-addons-browse position-relative">
                                    <input
                                        className="form-control mr-sm-2"
                                        type="search"
                                        placeholder="Buscar Complementos..."
                                        value={searchQuery}
                                        onChange={handleBuscarChange}
                                    />
                                    <i className="bi bi-search position-absolute text-muted pe-none"></i>
                                </div>
                            </div>
                            <div className="col-12 col-md-2">
                                <div className="addon-filter-input">
                                    <Select
                                        isMulti
                                        options={categories}
                                        value={selectedCategories}
                                        onChange={handleCategoryChange}
                                        placeholder="Categories"
                                        className="dark-select"
                                        classNamePrefix="warperia-select"
                                        noOpcionesMessage={({ inputValue }) =>
                                            `No results for "${inputValue}"`
                                        }
                                    />
                                </div>
                            </div>
                            <div className="col-12 col-md-2">
                                <Select
                                    value={selectedSorting}
                                    options={sortingOpciones}
                                    onChange={handleSortingChange}
                                    placeholder="Sort By"
                                    className="dark-select"
                                    classNamePrefix="warperia-select"
                                />
                            </div>
                        </div>
                        {loading ? (
                            <div className="text-center my-4">
                                <div className="spinner-border" role="status">
                                    <span className="visually-hidden">Loading Complementos...</span>
                                </div>
                            </div>
                        ) : (
                            <>
                                {addons.length > 0 ? (
                                    renderComplementosList(addons)
                                ) : (
                                    <p className="text-muted">No addons found.</p>
                                )}
                                <Pagination
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    onPageChange={handlePageChange}
                                    onJumpToPage={handleJumpToPage}
                                />
                            </>
                        )}
                    </div>
                </div>
                {settings &&
                    settings.enable_ads_banner_bottom === 1 &&
                    settings.app_ads_image_banner_bottom && (
                        <section className="container py-3 text-center">
                            <img
                                src={settings.app_ads_image_banner_bottom}
                                alt="Bottom Banner Ad"
                                className="img-fluid"
                                draggable="false"
                                style={{ maxHeight: "150px", objectFit: "contain" }}
                            />
                        </section>
                    )}
            </div>
            <ContextMenu
                xPos={contextMenu.xPos}
                yPos={contextMenu.yPos}
                onReinstall={
                    contextMenu.addon && contextMenu.isInstalared
                        ? handleReinstallAddon
                        : null
                }
                onInstalar={
                    contextMenu.addon
                        ? handleInstalarAddon
                        : null
                }
                onDelete={
                    contextMenu.addon && contextMenu.isInstalared
                        ? handleDeleteAddon
                        : null
                }
                onViewAddon={handleViewAddon}
                onViewOnWarperia-TDLO={() => handleViewOnWarperia-TDLO(contextMenu.addon)}
                onReport={handleReportAddon}
                visible={contextMenu.visible}
                isInstalared={contextMenu.isInstalared}
                addonImage={contextMenu.addonImage}
                addonName={contextMenu.addonName}
                addonData={contextMenu.addon}
                folderList={contextMenu.folderList}
                onOpenAddonFolder={handleOpenAddonFolder}
            />
            {showAddonSelectionModal && (
                <Suspense
                    fallback={
                        <div className="text-center my-4">
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    }
                >
                    <AddonSelectionModal
                        matchedComplementos={currentModalData}
                        onSelectAddon={handleSelectAddon}
                        onCancel={handleCancelAddonSelection}
                    />
                </Suspense>
            )}
            {showSwitchModal && (
                <Suspense
                    fallback={
                        <div className="text-center my-4">
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    }
                >
                    <SwitchVariationModal
                        show={showSwitchModal}
                        onHide={() => setShowSwitchModal(false)}
                        availableVariations={availableVariations}
                        onSwitchVariation={handleSwitchVariation}
                        currentAddon={currentAddon}
                        loading={loadingVariations}
                        downloading={downloading}
                        installingAddonId={installingAddonId}
                        installingAddonStep={installingAddonStep}
                        progress={progress}
                    />
                </Suspense>
            )}
            {showExportModal && (
                <Suspense
                    fallback={
                        <div className="text-center my-4">
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    }
                >
                    <ExportModal
                        show={showExportModal}
                        onClose={closeExportModal}
                        installedComplementos={installedComplementos}
                        showToastMessage={showToastMessage}
                    />
                </Suspense>
            )}
            {showImportModal && (
                <Suspense
                    fallback={
                        <div className="text-center my-4">
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    }
                >
                    <ImportModal
                        show={showImportModal}
                        onClose={closeImportModal}
                        onImportComplementos={handleImportComplementos}
                        showToastMessage={showToastMessage}
                    />
                </Suspense>
            )}
            {showReportModal && (
                <Suspense
                    fallback={
                        <div className="text-center my-4">
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    }
                >
                    <ReportModal
                        show={showReportModal}
                        onClose={() => setShowReportModal(false)}
                        onSubmit={handleReportSubmit}
                        addonName={currentAddonForReport?.title}
                    />
                </Suspense>
            )}
            {showDeleteModal && deleteModalData.addon && (
                <Suspense
                    fallback={
                        <div className="text-center my-4">
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    }
                >
                    <DeleteConfirmationModal
                        show={showDeleteModal}
                        onClose={() => setShowDeleteModal(false)}
                        onConfirmDelete={confirmDeleteComplementos}
                        addonToDelete={deleteModalData.addon}
                        newAddon={deleteModalData.newAddon}
                        parentAvisos={deleteModalData.parents}
                        nestedComplementos={deleteModalData.children}
                        isInstalaration={deleteModalData.isInstalaration}
                    />
                </Suspense>
            )}

            {showModal && (
                <Suspense
                    fallback={
                        <div className="text-center my-4">
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    }
                >
                    <AddonModal
                        show={showModal}
                        onHide={handleCloseModal}
                        addon={selectedAddon}
                        loading={addonLoading}
                        installedAddon={Object.values(installedComplementos).find(a => a.id === selectedAddon?.id)}
                        downloading={downloading}
                        installingAddonId={installingAddonId}
                        installingAddonStep={installingAddonStep}
                        progress={progress}
                        onInstalar={handleInstalarAddon}
                        onReinstall={(addon, e) => handleInstalarAddon(addon, e, true)}
                    />
                </Suspense>
            )}

            <ToastNotifications
                toasts={toasts}
                onRemoveToast={(toastId) =>
                    setToasts((prevToasts) => prevToasts.filter((t) => t.id !== toastId))
                }
            />
        </div>
    );
};

export default ComplementosPage;