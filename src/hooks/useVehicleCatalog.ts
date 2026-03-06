import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../constants/config';

export interface VehicleMake {
  id: string;
  name: string;
}

export interface VehicleModel {
  id: string;
  name: string;
}

export function useVehicleCatalog() {
  const [makes, setMakes] = useState<VehicleMake[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [loadingMakes, setLoadingMakes] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMakes = useCallback(async () => {
    setLoadingMakes(true);
    setError(null);
    try {
      const res = await axios.get<VehicleMake[]>(`${API_URL}/api/vehicles/makes`);
      setMakes(res.data || []);
    } catch (e) {
      console.error('Failed to fetch makes:', e);
      setError('Failed to load makes');
      setMakes([]);
    } finally {
      setLoadingMakes(false);
    }
  }, []);

  const fetchModels = useCallback(async (makeId: string) => {
    if (!makeId?.trim()) {
      setModels([]);
      return;
    }
    setLoadingModels(true);
    setError(null);
    try {
      const res = await axios.get<VehicleModel[]>(`${API_URL}/api/vehicles/models`, {
        params: { makeId: makeId.trim() },
      });
      setModels(res.data || []);
    } catch (e) {
      console.error('Failed to fetch models:', e);
      setError('Failed to load models');
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    fetchMakes();
  }, [fetchMakes]);

  return {
    makes,
    models,
    loadingMakes,
    loadingModels,
    error,
    fetchMakes,
    fetchModels,
  };
}
