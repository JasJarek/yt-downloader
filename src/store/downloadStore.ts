import { create } from 'zustand';
import { DownloadJob, DownloadProgress, DownloadFinished } from '../types';

interface DownloadState {
  jobs: DownloadJob[];
  addJob: (job: DownloadJob) => void;
  updateProgress: (p: DownloadProgress) => void;
  finishJob: (f: DownloadFinished) => void;
  cancelJob: (id: string) => void;
  removeJob: (id: string) => void;
  clearCompleted: () => void;
}

export const useDownloadStore = create<DownloadState>((set) => ({
  jobs: [],

  addJob: (job) =>
    set((state) => ({ jobs: [...state.jobs, job] })),

  updateProgress: ({ id, percent, speed, eta, stage }) =>
    set((state) => ({
      jobs: state.jobs.map((j) => {
        if (j.id !== id) return j;
        // stage prefixed with "warn:" is a diagnostic message, don't change status
        if (stage.startsWith('warn:')) {
          return { ...j, stage };
        }
        return {
          ...j, percent, speed, eta, stage,
          status: stage === 'converting' ? 'converting' : 'downloading',
        };
      }),
    })),

  finishJob: ({ id, status }) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id ? { ...j, status, percent: status === 'completed' ? 100 : j.percent } : j
      ),
    })),

  cancelJob: (id) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id ? { ...j, status: 'cancelled' } : j
      ),
    })),

  removeJob: (id) =>
    set((state) => ({ jobs: state.jobs.filter((j) => j.id !== id) })),

  clearCompleted: () =>
    set((state) => ({
      jobs: state.jobs.filter((j) => j.status === 'downloading' || j.status === 'converting' || j.status === 'pending'),
    })),
}));
