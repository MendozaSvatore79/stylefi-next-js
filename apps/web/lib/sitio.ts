/** Datos públicos del sitio para buscadores y redes (robots.txt, sitemap y Open Graph). */
export const SITIO = "https://stylehub.synovasystems.com";

export const DESCRIPCION_SITIO =
  "Reserva citas en barberías y salones de belleza, y administra la agenda de tu negocio en un solo lugar.";

/** Páginas públicas que vale la pena indexar. */
export const PAGINAS_PUBLICAS = ["/", "/register", "/iniciar-sesion", "/terms-of-service", "/privacy-policy"];

/** Lo que no debe aparecer en buscadores: paneles, flujos de sesión y registro a medias. */
export const NO_INDEXAR = ["/dashboard/", "/entrar", "/registro/", "/cuenta-suspendida"];
