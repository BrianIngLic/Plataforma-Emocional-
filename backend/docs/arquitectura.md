# Arquitectura del Sistema - Plan B (Híbrido)

- [cite_start]**Backend Core**: FastAPI montado localmente en Fedora[cite: 44, 45].
- [cite_start]**Seguridad**: Túnel seguro expuesto mediante Cloudflare/Ngrok[cite: 44, 49].
- [cite_start]**Base de Datos Vectorial**: ChromaDB local encargada del almacenamiento de embeddings de MentalChat-16K[cite: 45, 55].
- [cite_start]**Detector de Crisis**: Orquestado localmente mediante NLP ligero/Regex previo a la inferencia[cite: 45, 66].
- [cite_start]**Inferencia Conversacional**: LLaMA 3.1 8B delegada externamente a la API de Groq/OpenRouter para optimizar latencias[cite: 45].

