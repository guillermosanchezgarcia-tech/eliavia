import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { criteriosDeParametros } from '../lib/fincas'

/** Búsqueda y filtros de fincas tomados de la dirección, con identidad estable mientras no cambien. */
export function useCriteriosFincas() {
  const [parametros] = useSearchParams()
  const clave = parametros.toString()
  return useMemo(() => criteriosDeParametros(new URLSearchParams(clave)), [clave])
}
