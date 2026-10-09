/** Une clases CSS ignorando las vacías: cx('a', falso && 'b', 'c') → 'a c'. */
export function cx(...clases: (string | false | null | undefined)[]) {
  return clases.filter(Boolean).join(' ')
}
