export function HSLToHex(h: number, s:number, l:number) {
    s /= 100;
    l /= 100;

  
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c/2;
    let r = 0;
    let g = 0; 
    let b = 0; 
  
    if (0 <= h && h < 60) {
      r = c; g = x; b = 0;
    } else if (60 <= h && h < 120) {
      r = x; g = c; b = 0;
    } else if (120 <= h && h < 180) {
      r = 0; g = c; b = x;
    } else if (180 <= h && h < 240) {
      r = 0; g = x; b = c;
    } else if (240 <= h && h < 300) {
      r = x; g = 0; b = c;
    } else if (300 <= h && h < 360) {
      r = c; g = 0; b = x;
    }
    // Having obtained RGB, convert channels to hex
    let rr = Math.round((r + m) * 255).toString(16);
    let gg = Math.round((g + m) * 255).toString(16);
    let bb = Math.round((b + m) * 255).toString(16);
  
    // Prepend 0s, if necessary
    if (rr.length == 1)
      rr = "0" + r;
    if (gg.length == 1)
      gg = "0" + g;
    if (bb.length == 1)
      bb = "0" + b;
  
    return "#" + rr + gg + bb;
  }