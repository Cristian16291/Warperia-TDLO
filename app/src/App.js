import React, { useState, useEffect, useCallback } from "react";
import { HashRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import Registration from "./Registration.js";
import Acceder from "./Acceder.js";
import Home from "./Home.js";
import UserAjustes from "./UserAjustes.js";
import ServidoresList from "./Addons/views/ServidoresList.js";
import ServerPage from "./Addons/views/ServerPage.js";
import axios from "axios";
import { WEB_URL } from './config.js';

const App = () => {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState("light");
  const [currentPage, setCurrentPage] = useState("home");

  // Actualizar state
  const [isUpdating, setIsUpdating] = useState(false);
  const [downloadProgress, setDescargarProgress] = useState(0);
  const [updateDescargared, setActualizarDescargared] = useState(false);

  const setPage = (page) => {
    setCurrentPage(page);
  };

  useEffect(() => {
    const initializeUser = async () => {
      try {
        const tokenResult = await window.electron.retrieveToken();
        const userResult = await window.electron.retrieveUser();

        if (tokenResult.success && tokenResult.token && userResult.success && userResult.user) {
          console.log("User and token retrieved successfully:", userResult.user);
          setUser(userResult.user);
        } else {
          console.error("Failed to retrieve user or token.");
          await window.electron.clearToken();
          await window.electron.clearUser();
          setIsTokenValid(false); // Set token as invalid if retrieval fails
        }
      } catch (error) {
        console.error("Error during user initialization:", error);
        setIsTokenValid(false); // Set token as invalid on error
      } finally {
        setLoadingUser(false);
      }
    };
    initializeUser();
  }, []);

  const handleAcceder = (user) => {
    setUser(user);
  };

  const handleLogout = async () => {
    setUser(null);
    await window.electron.clearToken();
    await window.electron.clearUser();
  };

  useEffect(() => {

    window.electron.onActualizarAvailable((info) => {
      setIsUpdating(true);
    });

    window.electron.onActualizarProgress((progress) => {
      setDescargarProgress(progress);
    });

    window.electron.onActualizarDescargared((info) => {
      setDescargarProgress(100);
      setActualizarDescargared(true);
      setIsUpdating(false);
      setToastMessage(`Actualizar v${info.version} downloaded and will be installed on restart.`);
      setToastType('success');
    });

    window.electron.onActualizarError((error) => {
      setIsUpdating(false);
      setToastMessage(`Actualizar failed: ${error}`);
      setToastType('danger');
    });

    return () => {
    };
  }, []);

  useEffect(() => {
    // Remove the loading screen once the app mounts
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.remove();
    }
}, []);

  return (
    <Router>
      <div className="h-100">
        {loadingUser ? (
          <div className="text-center my-5">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading user...</span>
            </div>
          </div>
        ) : isUpdating ? (
          // Actualizar Progress UI
          <div className="update-progress d-flex justify-content-center align-items-center vh-100">
            <div className="text-center">
              <div className="d-flex align-items-center gap-3">
                <div className="spinner-border" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <div className="fs-5">Warperia-TDLO is being updated</div>
              </div>
              <div className="progress rounded-0 mt-3">
                <div
                  className="progress-bar bg-primary"
                  role="progressbar"
                  style={{ width: `${downloadProgress}%` }}
                  aria-valuenow={downloadProgress}
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                </div>
              </div>
              <div className="mt-3">({downloadProgress}%)</div>
            </div>
          </div>
        ) : (
          // Main content
          <Routes>
            <Route
              path="/login"
              element={user ? <Navigate to="/home" /> : <Acceder onAcceder={handleAcceder} />}
            />
            <Route
              path="/register"
              element={user ? <Navigate to="/home" /> : <Registration />}
            />
            <Route
              path="/home"
              element={user ? <Home user={user} setPage={setPage} /> : <Navigate to="/login" />}
            />
            <Route
              path="/settings"
              element={user ? <UserAjustes user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
            />
            <Route
              path="/servers"
              element={user ? <ServidoresList user={user} /> : <Navigate to="/login" />}
            />
            <Route path="/server/:serverId" element={<ServerPage user={user} />} />
            <Route
              path="/"
              element={<Navigate to="/login" />}
            />
            <Route
              path="*"
              element={<div>Page not found</div>}
            />
          </Routes>
        )}

        {/* Descargar Progress Overlay */}
        {isUpdating && (
          <div className="update-progress position-fixed top-0 left-0 w-100 h-100 d-flex justify-content-center align-items-center bg-dark bg-opacity-50">
            <div className="text-center text-white">
              <div className="spinner-border" role="status">
                <span className="visually-hidden">Descargaring update...</span>
              </div>
              <div className="mt-3">Descargaring update for Warperia-TDLO...</div>
              <div className="progress rounded-0 mt-3">
                <div
                  className="progress-bar"
                  role="progressbar"
                  style={{ width: `${downloadProgress}%` }}
                  aria-valuenow={downloadProgress}
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                </div>
              </div>
            </div>
          </div>
        )}

        {updateDescargared && (
          <div className="update-bar position-fixed bottom-0 start-0 end-0 bg-dark text-white p-3 d-flex justify-content-between align-items-center">
            <span className="fw-bolder">A new update has been downloaded for Warperia-TDLO</span>
            <button
              className="btn btn-primary fw-bold"
              onClick={() => autoActualizarr.quitAndInstalar(false, true)}
            >
              Instalar Actualizar
            </button>
          </div>
        )}
        
        {toastMessage && (
          <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 11 }}>
            <div className={`toast show text-bg-${toastType}`} role="alert" aria-live="assertive" aria-atomic="true">
              <div className={`toast-header text-${toastType}`}>
                <strong className="me-auto">
                  <i className="bi bi-bell"></i> Notification
                </strong>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  data-bs-dismiss="toast"
                  aria-label="Close"
                  onClick={() => setToastMessage(null)}
                ></button>
              </div>
              <div className="toast-body">{toastMessage}</div>
            </div>
          </div>
        )}
      </div>
    </Router>
  );
};

export default App;