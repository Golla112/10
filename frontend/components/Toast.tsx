'use client';

import { useEffect, useState } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

// Global state for toasts
let toasts: Toast[] = [];
let listeners: ((toasts: Toast[]) => void)[] = [];

function notifyListeners() {
  listeners.forEach(listener => listener([...toasts]));
}

export function showToast(message: string, type: ToastType = 'info') {
  const id = Math.random().toString(36).substring(2, 9);
  toasts = [...toasts, { id, message, type }];
  notifyListeners();
  
  // Auto remove after 4 seconds
  setTimeout(() => {
    removeToast(id);
  }, 4000);
}

export function removeToast(id: string) {
  toasts = toasts.filter(t => t.id !== id);
  notifyListeners();
}

function useToasts() {
  const [state, setState] = useState<Toast[]>([]);
  
  useEffect(() => {
    listeners.push(setState);
    setState([...toasts]);
    return () => {
      listeners = listeners.filter(l => l !== setState);
    };
  }, []);
  
  return state;
}

function getToastStyles(type: ToastType) {
  switch (type) {
    case 'success':
      return 'bg-green-500 text-white';
    case 'error':
      return 'bg-red-500 text-white';
    case 'warning':
      return 'bg-yellow-500 text-black';
    case 'info':
      return 'bg-blue-500 text-white';
  }
}

function getToastIcon(type: ToastType) {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '✗';
    case 'warning':
      return '⚠';
    case 'info':
      return 'ℹ';
  }
}

export default function Toast() {
  const toastsList = useToasts();

  if (toastsList.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[300] space-y-2">
      {toastsList.map((toast, index) => (
        <div
          key={toast.id}
          className={`
            ${getToastStyles(toast.type)}
            px-4 py-3 rounded-xl shadow-lg
            flex items-center gap-3 min-w-[280px]
            transform transition-all duration-300
            animate-in slide-in-from-right
          `}
          style={{
            animationDelay: `${index * 100}ms`,
          }}
        >
          <span className="text-lg font-bold">{getToastIcon(toast.type)}</span>
          <span className="font-medium text-sm flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="opacity-70 hover:opacity-100 text-lg leading-none"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
