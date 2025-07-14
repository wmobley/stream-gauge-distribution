import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet-defaulticon-compatibility';
import { createRoot } from 'react-dom/client';
import Legend from './Legend';
import Popup from './Popup';

// These do not depend on component state, so they can be defined outside.
const visualizationOptions = [
  { value: 'risk', label: 'Risk Analysis', rankField: 'rank_risk', valueField: 'risk' },
  { value: 'hazard', label: 'Hazard Analysis', rankField: 'rank_haz', valueField: 'hazard' },
  { value: 'exposure', label: 'Exposure Analysis', rankField: 'rank_exposure', valueField: 'exposure' },
  { value: 'vulnerability', label: 'Vulnerability Analysis', rankField: 'rank_vulnerability', valueField: 'vulnerability' }
];

// 10 purple gradient colors for decile distribution
const purpleGradientColors = [
  '#F8F4FF', // Very light lavender - 0-10%
  '#E8D5F2', // Light lavender - 10-20%
  '#D4B3E8', // Soft purple - 20-30%
  '#C191DE', // Light purple - 30-40%
  '#BD6FCB', // Mystic Magenta - 40-50%
  '#A855C7', // Medium purple - 50-60%
  '#9333EA', // Bright purple - 60-70%
  '#7C3AED', // Deep purple - 70-80%
  '#6B21A8', // Dark purple - 80-90%
  '#581C87'  // Very dark purple - 90-100%
];

// Helper function to format numbers (remove trailing zeros)
const formatNumber = (value) => {
  if (value === null || value === undefined) return 'N/A';
  const num = parseFloat(value);
  if (isNaN(num)) return 'N/A';
  // Remove trailing zeros and unnecessary decimal point
  return num % 1 === 0 ? num.toString() : num.toString().replace(/\.?0+$/, '');
};

// Helper function to format numbers with 3 decimal places for legend
const formatLegendNumber = (value) => {
  if (value === null || value === undefined) return 'N/A';
  const num = parseFloat(value);
  if (isNaN(num)) return 'N/A';
  return num.toFixed(3);
};

// Function to calculate decile-based ranges (10% each)
const calculateDataRanges = (data, valueField) => {
  if (!data || !data.features) return null;

  const values = data.features
    .map(feature => feature.properties[valueField])
    .filter(val => val !== null && val !== undefined && !isNaN(val) && val > 0)
    .sort((a, b) => a - b);

  if (values.length === 0) return null;

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  
  // Use decile-based ranges (10% each)
  const percentiles = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const ranges = [];
  
  for (let i = 0; i < percentiles.length - 1; i++) {
    const startIndex = Math.floor((percentiles[i] / 100) * (values.length - 1));
    const endIndex = Math.floor((percentiles[i + 1] / 100) * (values.length - 1));
    
    const rangeStart = values[startIndex];
    const rangeEnd = i === percentiles.length - 2 ? maxValue : values[endIndex];
    
    ranges.push({
      min: rangeStart,
      max: rangeEnd,
      color: purpleGradientColors[i],
      percentile: `${percentiles[i]}-${percentiles[i + 1]}%`
    });
  }

  return {
    min: minValue,
    max: maxValue,
    ranges,
    values
  };
};

// Function to create popup content using React component
const createPopupContent = (feature, currentVisualization, visualizationType, dataRanges) => {
  const popupDiv = document.createElement('div');
  const root = createRoot(popupDiv);
  
  root.render(
    <Popup 
      feature={feature}
      currentVisualization={currentVisualization}
      visualizationType={visualizationType}
      logRanges={dataRanges}
      formatNumber={formatNumber}
    />
  );
  
  return popupDiv;
};

const MapComponent = () => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const currentLayerRef = useRef(null);
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visualizationType, setVisualizationType] = useState('risk');

  // Load GeoJSON data
  useEffect(() => {
    const loadGeoJsonData = async () => {
      try {
        setLoading(true);
        const response = await fetch(import.meta.env.VITE_API_GEOJSON_URL);
        if (!response.ok) {
          throw new Error(`Failed to load data: ${response.statusText}`);
        }
        const data = await response.json();
        setGeoJsonData(data);
        setError(null);
      } catch (err) {
        console.error('Error loading GeoJSON data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadGeoJsonData();
  }, []);

  // Memoize derived state for performance
  const currentVisualization = useMemo(() =>
    visualizationOptions.find(opt => opt.value === visualizationType),
    [visualizationType]
  );

  const dataRanges = useMemo(() => {
    if (!geoJsonData || !currentVisualization) return null;
    return calculateDataRanges(geoJsonData, currentVisualization.valueField);
  }, [geoJsonData, currentVisualization]);

  const legendConfig = useMemo(() => {
    if (!dataRanges || !currentVisualization) return null;
    return {
      title: `${currentVisualization.label} Legend`,
      description: `Based on ${currentVisualization.valueField} values (decile distribution)`,
      visualizationType,
      ranges: dataRanges.ranges.map((range, index) => ({
        color: range.color,
        label: `${formatLegendNumber(range.min)} - ${formatLegendNumber(range.max)}`,
        description: [
          '1st Decile', '2nd Decile', '3rd Decile', '4th Decile', '5th Decile',
          '6th Decile', '7th Decile', '8th Decile', '9th Decile', '10th Decile'
        ][index] + ` (${range.percentile})`
      }))
    };
  }, [dataRanges, currentVisualization, visualizationType]);

  // Initialize map and add data
  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      // Initialize map
      mapRef.current = L.map(mapContainerRef.current).setView([40.7128, -74.006], 11);

      // Add base tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current);
    }

    // Add/Update GeoJSON layer when data or visualization changes
    if (mapRef.current && geoJsonData && dataRanges && currentVisualization) {
      // Clear existing data layer
      if (currentLayerRef.current) {
        mapRef.current.removeLayer(currentLayerRef.current);
        currentLayerRef.current = null;
      }

      // Fit map to data bounds on first load (risk analysis)
      if (visualizationType === 'risk' && currentLayerRef.current === null) { // Only fit once
        mapRef.current.fitBounds(L.geoJSON(geoJsonData).getBounds(), { padding: [20, 20] });
      }

      // Filter out features with zero or invalid values
      const filteredFeatures = geoJsonData.features.filter(feature => {
        const value = feature.properties[currentVisualization.valueField];
        return value !== null && value !== undefined && !isNaN(value) && value > 0;
      });

      // Create filtered GeoJSON data
      const filteredGeoJsonData = {
        ...geoJsonData,
        features: filteredFeatures
      };

      // Helper function to get color based on decile position
      const getValueColor = (value) => {
        // Find which range this value falls into
        for (let i = 0; i < dataRanges.ranges.length; i++) {
          const range = dataRanges.ranges[i];
          if (value >= range.min && value <= range.max) {
            return range.color;
          }
        }
        // Fallback to last color if value is above all ranges
        return dataRanges.ranges[dataRanges.ranges.length - 1].color;
      };

      // Helper function to get opacity based on value position within range
      const getValueOpacity = (value) => {
        // Normalize value to 0-1 scale
        const normalizedValue = (value - dataRanges.min) / (dataRanges.max - dataRanges.min);
        
        // Scale opacity between 0.5-0.9 based on position
        return Math.max(0.5, Math.min(0.9, normalizedValue * 0.4 + 0.5));
      };

      // Create the visualization layer using filtered data
      const visualizationLayer = L.geoJSON(filteredGeoJsonData, {
        style: (feature) => {
          const value = feature.properties[currentVisualization.valueField];
          
          return {
            color: getValueColor(value),
            weight: 2,
            opacity: 0.8,
            fillOpacity: getValueOpacity(value),
          };
        },
        pointToLayer: (feature, latlng) => {
          const value = feature.properties[currentVisualization.valueField];
          return L.circleMarker(latlng, {
            radius: 6,
            fillColor: getValueColor(value),
            color: '#000',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8,
          });
        },
        onEachFeature: (feature, layer) => {
          const popupContent = createPopupContent(feature, currentVisualization, visualizationType, dataRanges);
          layer.bindPopup(popupContent);
        },
      });

      // Add layer to map
      visualizationLayer.addTo(mapRef.current);
      currentLayerRef.current = visualizationLayer;
    }
  }, [geoJsonData, dataRanges, currentVisualization, visualizationType]);

  // Separate cleanup effect for component unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Handle visualization type change
  const handleVisualizationChange = (event) => {
    setVisualizationType(event.target.value);
  };

  // Render loading or error states
  if (loading) {
    return (
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading water risk data...</p>
        </div>
        {legendConfig && <Legend config={legendConfig} />}
      </div>
    );
  }

  if (error) {
    return (
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-gray-100">
        <div className="text-center text-red-600">
          <p className="text-lg font-semibold mb-2">Error loading data</p>
          <p className="text-sm">{error}</p>
        </div>
        {legendConfig && <Legend config={legendConfig} />}
      </div>
    );
  }

  return (
    <>
      <div
        ref={mapContainerRef}
        className="absolute inset-0 z-0"
        aria-label="Map showing water risk analysis with stream gauge distribution"
      />
      
      {/* Visualization Type Selector */}
      <div className="absolute top-4 right-4 z-[1000] bg-white bg-opacity-90 rounded-lg shadow-lg border border-gray-200 p-3">
        <label htmlFor="visualization-select" className="block text-sm font-medium text-gray-700 mb-2">
          Visualization Type:
        </label>
        <select
          id="visualization-select"
          value={visualizationType}
          onChange={handleVisualizationChange}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        >
          {visualizationOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {legendConfig && <Legend config={legendConfig} />}
    </>
  );
};

export default MapComponent;