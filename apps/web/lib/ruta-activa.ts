/**
 * ¿Este elemento del menú corresponde a la ruta actual? La raíz del panel (Resumen) solo con la ruta exacta: antes
 * coincidía con todas las subrutas por el prefijo, se quedaba iluminada junto a la pestaña activa y el título decía
 * «Resumen» en todas. Las demás coinciden con su ruta o sus subrutas (por segmento: /soporte no es /soporte-x).
 */
export function rutaActiva(pathname: string, href: string, raiz: string): boolean {
  if (href === raiz) return pathname === raiz;
  return pathname === href || pathname.startsWith(`${href}/`);
}
