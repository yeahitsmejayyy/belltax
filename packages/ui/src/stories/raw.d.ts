// Vite's ?raw imports (a file's source as a string), used to show story fixtures on Docs pages.
declare module "*?raw" {
  const source: string;
  export default source;
}
