# gm-grafo-app

Este repositorio contiene el MVP del Front-End para el Generador de Grafos v1.0 del reto GM. 
La interfaz está diseñada como un dashboard web (sidebar + vista central + panel de información) y permite cargar un archivo JSON para visualizar un grafo en 3D dentro del navegador.

La visualización se realiza con WebGL mediante la librería 3d-force-graph (basada en Three.js). El Front-End recibe como entrada un JSON con relaciones (verbos que conectan entidades) que será proporcionado por el equipo encargado de backend. A partir de ese JSON, el sistema renderiza nodos y conexiones, muestra métricas básicas (nodos y conexiones) y ofrece interacción mínima para explorar el grafo.

## Funcionalidades:
- Carga de JSON (drag & drop o selector de archivo).
- Visualización 3D del grafo en el navegador (WebGL).
- Panel de información: nombre, fecha, número de nodos y conexiones.
- Historial de grafos cargados (lista para reabrir visualizaciones).
- Expandir conexiones (K-hop): cambia el nivel de exploración alrededor del nodo seleccionado (K=1→4).
- Resumen automático: estadísticas básicas del grafo (top nodos/verbos).

## Tecnologías

- **Front-End:** HTML, CSS, JavaScript (vanilla)
- **Visualización 3D:** `3d-force-graph` (WebGL / Three.js)
- **Servidor local (desarrollo):** Node.js + Express  
  > Se usa únicamente para servir la app en `localhost` y facilitar la carga del JSON por HTTP.  
  > No hay base de datos (el historial es temporal).
--

**Descripción rápida**
- `public/index.html`: estructura del dashboard (sidebar, grafo, panel info, modal)
- `public/styles.css`: estilos visuales (layout tipo mockup)
- `public/app.js`: lógica de front (carga JSON, render 3D, K-hop, historial, resumen)
- `server.js`: servidor local mínimo para servir el front y facilitar la carga del JSON
---

## Cómo ejecutar:
### Instalar dependencias:
```bash
npm install
```
### Correr el proyecto:
```bash
npm run dev
```
- Abrir en el navegador:
  http://localhost:5173


## Formato esperado del JSON (ejemplo)
{
  "choca": ["coche","edificio"],
  "muerde": ["perro","pelota"],
  "tiene": ["usuario","perro"]
}

### También se soporta formato con múltiples pares por verbo:

{
  "choca": [["coche","edificio"], ["auto","poste"]],
  "tiene": [["usuario","perro"], ["usuario","coche"]]
}


## Cómo usar la app
- Abre la app en localhost
- Carga un JSON (arrastrar/soltar o “Elegir archivo JSON”)
- Se renderiza el grafo 3D en el panel central
- Haz click en un nodo:
    - se vuelve el “centro” para exploración
- Usa Expandir Conexiones para aumentar el alcance (K-hop)
- Usa Ver Resumen para ver estadísticas rápidas del grafo

## Avances
- El campo “Ingrese su consulta” está como UI placeholder para conectar después con consultas GraphRAG/Neo4j.
- El historial es temporal (en memoria durante la ejecución del servidor local)

## Próximos pasos
- Conectar la caja “consulta” a un endpoint real (GraphRAG / Cypher / API)
- Mejorar exploración:
  - búsqueda de nodos por nombre
  - resaltado (highlight) de nodo y vecinos
  - filtro por verbos (tipo de relación)
- Integración con el backend del equipo de datos/BD:
  - consumir JSON desde API en lugar de archivo
  - expansión de conexiones vía endpoint (subgrafos)
