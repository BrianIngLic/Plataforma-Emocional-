import { Injectable, signal } from '@angular/core';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  // Estado reactivo de los mensajes
  private messagesSignal = signal<ChatMessage[]>([]);
  public messages = this.messagesSignal.asReadonly();

  // Estado de carga/escritura
  private isTypingSignal = signal<boolean>(false);
  public isTyping = this.isTypingSignal.asReadonly();

  constructor() {
    // Mensaje de bienvenida inicial
    this.messagesSignal.set([
      {
        id: this.generateId(),
        role: 'assistant',
        content: '¡Hola! Soy EmolA, tu asistente emocional. ¿Cómo te sientes hoy?',
        timestamp: new Date()
      }
    ]);
  }

  // Enviar mensaje real a la UI e iniciar mock
  async sendMessage(content: string) {
    if (!content.trim()) return;

    // 1. Agregar mensaje del usuario
    const userMsg: ChatMessage = {
      id: this.generateId(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    };
    
    this.messagesSignal.update(msgs => [...msgs, userMsg]);
    this.isTypingSignal.set(true);

    // 2. Simular retraso de red (pensando...)
    await this.delay(800 + Math.random() * 1000);

    // 3. Crear mensaje vacío de la IA para iniciar streaming
    const aiMsgId = this.generateId();
    const aiMsg: ChatMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    };
    
    this.messagesSignal.update(msgs => [...msgs, aiMsg]);
    this.isTypingSignal.set(false);

    // 4. Iniciar streaming falso
    this.streamMockResponse(aiMsgId, this.getMockResponse(content));
  }

  private async streamMockResponse(messageId: string, fullText: string) {
    // Dividimos por tokens/palabras para simular un LLM
    const chunks = fullText.split(' ');
    let currentText = '';

    for (let i = 0; i < chunks.length; i++) {
      currentText += (i === 0 ? '' : ' ') + chunks[i];
      
      // Actualizar el mensaje específico con el texto que va llegando
      this.messagesSignal.update(msgs => 
        msgs.map(m => m.id === messageId ? { ...m, content: currentText } : m)
      );

      // Pequeña pausa entre palabras para simular la generación de tokens (como ChatGPT)
      await this.delay(30 + Math.random() * 60);
    }

    // Terminar streaming
    this.messagesSignal.update(msgs => 
      msgs.map(m => m.id === messageId ? { ...m, isStreaming: false } : m)
    );
  }

  // Base de conocimientos simulada temporalmente
  private getMockResponse(input: string): string {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('estrés') || lowerInput.includes('ansios') || lowerInput.includes('trabajo')) {
      return 'Entiendo, la ansiedad es algo que muchas personas enfrentan. Es valiente que lo reconozcas y lo compartas.\n\nAquí tienes **3 técnicas** que te pueden ayudar ahora mismo:\n1. **Respiración 4-7-8**: Inhala en 4s, sostén 7s y exhala en 8s.\n2. **Técnica 5-4-3-2-1**: Nombra 5 cosas que ves, 4 que tocas, etc.\n3. Salir a caminar 5 minutos.\n\nCuéntame más: ¿hay algo específico que esté generando esa sensación?';
    }
    if (lowerInput.includes('hola') || lowerInput.includes('buenos dias')) {
      return '¡Hola de nuevo! Estoy aquí para escucharte sin juzgar. Puedes escribirme lo que sea que tengas en mente. ¿Qué tal va tu semana?';
    }
    
    return `He leído lo que me comentas sobre "${input.substring(0, 20)}...". Es completamente válido sentirse así. ¿Hay algo en particular que creas que detonó este sentimiento hoy?`;
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 9);
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
