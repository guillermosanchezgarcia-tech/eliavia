import { Redirect } from 'expo-router';
import React from 'react';

/** Cualquier ruta desconocida (p. ej. un enlace antiguo) vuelve al inicio. */
export default function NotFound() {
  return <Redirect href="/" />;
}
