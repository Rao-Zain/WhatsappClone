/* Registry of themes shown in the picker.
   To add one: (1) add a [data-theme="id"] palette block in theme.css,
   (2) add a line here. Nothing else changes. */
export const THEMES = [
  { id: "light", label: "Light", dark: false },
  { id: "dark", label: "Dark", dark: true },
  { id: "ocean", label: "Ocean", dark: false },
  { id: "rose", label: "Rose", dark: false },
];

export const DEFAULT_THEME = "light";

export const isDarkTheme = (id) => THEMES.find((t) => t.id === id)?.dark ?? false;