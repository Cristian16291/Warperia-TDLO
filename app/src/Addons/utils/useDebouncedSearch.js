import { useCallback } from 'react';
import { debounce } from 'lodash';
import axios from 'axios';
import { WEB_URL } from './../../config.js';

const useDebouncedBuscar = (setLoading, setComplementos, setTotalPages, setCurrentPage, selectedCategories, activeTab, setActiveTab, currentPostType, selectedSorting) => {
  const debouncedBuscar = useCallback(
    debounce(async (value, pageSize) => {
      let loadingTimeout;
      try {
        loadingTimeout = setTimeout(() => setLoading(true), 300); // Delayed loading state

        if (value.length >= 2) {
          const params = {
            search: value,
            page: 1,
            per_page: pageSize,
            addon_category: selectedCategories.length > 0 ? selectedCategories.map(option => option.value).join(',') : undefined,
            post_type: currentPostType,
          };

          const response = await axios.get(`${WEB_URL}/wp-json/wp/v2/addons/search-nested`, {
            params,
          });

          setComplementos(response.data);
          setTotalPages(parseInt(response.headers['x-wp-totalpages']) || 1);
          setCurrentPage(1);
        } else if (value.length === 0) {
          clearTimeout(loadingTimeout);
          setLoading(false);
          return;
        }

        if (activeTab !== 'browseComplementos') {
          setActiveTab('browseComplementos');
        }
      } catch (error) {
        console.error("Error fetching addons:", error);
        setComplementos([]);
        setTotalPages(1);
      } finally {
        clearTimeout(loadingTimeout);
        setLoading(false);
      }
    }, 300), // 300ms debounce delay
    [selectedCategories, activeTab, currentPostType, selectedSorting]
  );

  return debouncedBuscar;
};

export default useDebouncedBuscar;
