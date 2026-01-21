import { useState, useEffect, useCallback } from 'react';

export interface RecentProject {
  id: number;
  title: string;
  lastVisited: number;
}

const STORAGE_KEY = 'recent_projects';
const MAX_ITEMS = 10;

export function useRecentProjects() {
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

  // Load from storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRecentProjects(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load recent projects:', error);
    }
  }, []);

  // Add a project to history
  const addRecentProject = useCallback((project: { id: number; title: string }) => {
    setRecentProjects(prev => {
      // Remove existing entry if present
      const filtered = prev.filter(p => p.id !== project.id);
      // Add new entry at the top
      const newEntry: RecentProject = {
        id: project.id,
        title: project.title,
        lastVisited: Date.now()
      };
      const updated = [newEntry, ...filtered].slice(0, MAX_ITEMS);
      
      // Save to storage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save recent projects:', error);
      }
      
      return updated;
    });
  }, []);

  return {
    recentProjects,
    addRecentProject
  };
}
