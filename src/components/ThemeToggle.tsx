import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ darkMode, setDarkMode }) => {
  return (
    <button
      onClick={() => setDarkMode(!darkMode)}
      className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors duration-200 cursor-pointer"
      title={darkMode ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
    >
      {darkMode ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
};
export default ThemeToggle;
