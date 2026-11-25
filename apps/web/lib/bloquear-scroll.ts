import { type RefObject, useEffect } from "react";

type ElementoConEstilo = { style: { overflow: string }; parentElement: ElementoConEstilo | null };

/**
 * Bloquea el desplazamiento de todo lo que está detrás de un modal: cada ancestro que se desplaza (overflow auto o
 * scroll) y la raíz del documento. Devuelve cómo dejarlos como estaban. Sin esto, al llegar al final de la lista del
 * modal (o con la rueda sobre una parte que no se desplaza) se movía la página de atrás.
 */
export function bloquearFondo(
  elemento: ElementoConEstilo,
  raiz: ElementoConEstilo,
  overflowDe: (el: ElementoConEstilo) => string,
): () => void {
  const bloqueados: Array<{ el: ElementoConEstilo; antes: string }> = [];
  const bloquear = (el: ElementoConEstilo) => {
    if (bloqueados.some((b) => b.el === el)) return;
    bloqueados.push({ el, antes: el.style.overflow });
    el.style.overflow = "hidden";
  };
  for (let n = elemento.parentElement; n; n = n.parentElement) {
    if (/(auto|scroll)/.test(overflowDe(n))) bloquear(n);
  }
  bloquear(raiz);
  return () => {
    for (const { el, antes } of bloqueados.reverse()) el.style.overflow = antes;
  };
}

/** Mientras el componente esté montado, el fondo del modal (cuya raíz es `ref`) no se desplaza. */
export function useBloquearScrollDeFondo(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return bloquearFondo(el as unknown as ElementoConEstilo, document.documentElement as unknown as ElementoConEstilo, (n) =>
      getComputedStyle(n as unknown as Element).overflowY,
    );
  }, [ref]);
}
