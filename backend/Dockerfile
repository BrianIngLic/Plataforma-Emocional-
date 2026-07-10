FROM python:3.10-slim

WORKDIR /app

# Copiar archivos de dependencias
COPY requirements.txt .

# Instalar dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el backend y los módulos principales de la raíz del proyecto
COPY backend/ /app/backend/
COPY *.py contract.json /app/

# Exponer el puerto de FastAPI
EXPOSE 8000

# Arrancar el servidor
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
