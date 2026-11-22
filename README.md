# GeoMiner Bolivia v0.7 — Piloto Cerro Rico + contraste de fechas

**Actualización incremental:** Instalar v0.6 y luego v0.7, o aplicar el paquete acumulado v0.7 directamente sobre v0.5.

## Probar
1. Entrar a **Cerro Rico · Estudio piloto → Centrar y delimitar 25 km²**.
2. Abrir **Análisis**, buscar y procesar una primera escena Sentinel-2 L2A.
3. Abrir **Validar** y elegir una segunda escena diferente; se descargarán sus bandas para calcular la coincidencia espectral P90.
4. Abrir **Sectores**, seleccionar un sector; volver a **Validar** para añadir anotaciones del operador.
5. Exportar el expediente JSON, y luego abrir **Informe** para descargar el PDF con comparación y registros no auditados.

### Advertencias
- Coincidencia temporal **no es** evidencia ni probabilidad de mineralización.
- **No se han integrado capas geológicas oficiales georreferenciadas**; se enlazan USGS, NASA y SERGEOMIN, sin afirmar correspondencia espacial píxel a píxel.
- Los sectores pueden reflejar escombreras, roca removida, sombras, humedad o errores de clasificación.
- Los registros locales se pierden si se limpia el almacenamiento del navegador; exporta JSON para respaldo. No introduzcas datos personales sensibles.
- En Cerro Rico existe inestabilidad y protección patrimonial. No utilizar los marcadores para ingresar a sectores restringidos o peligrosos.
- No requiere cambiar las variables OpenAI de Vercel. No se habilita aún venta automatizada de informes.
