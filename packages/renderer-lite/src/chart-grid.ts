/** LWC grid line options — default off per product spec. */
export function gridOptions(showGrid: boolean, dark: boolean) {
  const color = dark ? '#21262d' : '#d0d7de';
  return {
    vertLines: { visible: showGrid, color },
    horzLines: { visible: showGrid, color },
  };
}