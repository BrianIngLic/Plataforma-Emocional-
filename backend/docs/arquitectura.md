# Arquitectura del Sistema - Plan B (Híbrido)

- [cite_start]**Backend Core**: FastAPI montado localmente en Fedora[cite: 44, 45].
- [cite_start]**Seguridad**: Túnel seguro expuesto mediante Cloudflare/Ngrok[cite: 44, 49].
- [cite_start]**Base de Datos Vectorial**: ChromaDB local encargada del almacenamiento de embeddings de MentalChat-16K[cite: 45, 55].
- [cite_start]**Detector de Crisis**: Orquestado localmente mediante NLP ligero/Regex previo a la inferencia[cite: 45, 66].
- [cite_start]**Inferencia Conversacional**: Inferencia Conversacional: Motor de inferencia local procesando LLaMA 3.1 8B (formato cuantizado GGUF) delegando el cómputo de tensores a la eGPU (NVIDIA RTX 5060 Ti) para máxima privacidad y mínima/nula latencia de red.

