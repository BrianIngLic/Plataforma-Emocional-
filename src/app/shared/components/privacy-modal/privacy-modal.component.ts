import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-privacy-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="privacy-modal-overlay" *ngIf="show" (click)="onClose()">
      <div class="privacy-modal-card" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h2>Aviso de Privacidad del Sistema</h2>
          <button class="close-btn" (click)="onClose()">✖</button>
        </div>
        <div class="modal-content">
          <ng-content></ng-content>
          <h3>AVISO INTEGRAL DE PRIVACIDAD, CONSENTIMIENTO INFORMADO Y CONDICIONES DE USO</h3>
          <p><strong>Plataforma de Asistencia Emocional basada en Inteligencia Artificial</strong><br>
          Última actualización: 24 de julio de 2026</p>

          <p><strong>1. Responsable del tratamiento de los datos personales</strong><br>
          La Plataforma de Asistencia Emocional basada en Inteligencia Artificial es un proyecto de investigación y desarrollo tecnológico de la Benemérita Universidad Autónoma de Puebla (BUAP).<br>
          La dependencia responsable del tratamiento de los datos personales será la Dirección de Acompañamiento Universitario (DAU) y la Facultad de Psicología de la BUAP.<br>
          Domicilio: Avenida San Claudio, Ciudad Universitaria, Col. San Manuel, Puebla, Pue. C.P. 72570<br>
          Correo electrónico para asuntos relacionados con protección de datos personales: transparencia&#64;correo.buap.mx<br>
          Responsable de Protección de Datos: Unidad de Transparencia y Acceso a la Información de la BUAP.</p>

          <p><strong>2. Finalidad de la plataforma</strong><br>
          La plataforma tiene como objetivo apoyar el bienestar emocional de sus usuarios mediante herramientas de Inteligencia Artificial, ofreciendo recursos de orientación, análisis emocional y seguimiento, siempre como complemento al acompañamiento realizado por profesionales de la salud. La plataforma no sustituye la atención psicológica, psiquiátrica ni médica.</p>

          <p><strong>3. Datos personales que podrán recabarse</strong><br>
          Para el funcionamiento de la plataforma podrán solicitarse, entre otros, los siguientes datos:<br>
          <strong>Datos de identificación:</strong> Nombre (cuando sea requerido), Correo electrónico, Edad, Sexo (opcional), Institución educativa (cuando aplique).<br>
          <strong>Datos técnicos:</strong> Dirección IP, Fecha y hora de acceso, Información del dispositivo, Registros de uso de la plataforma.<br>
          <strong>Datos personales sensibles:</strong> Dependiendo del uso de la plataforma podrán generarse o registrarse datos relacionados con: Estado emocional, Conversaciones sostenidas con la Inteligencia Artificial, Escalas de bienestar emocional, Factores de riesgo emocional, Indicadores relacionados con ansiedad, depresión o trastornos de la conducta alimentaria, e Información proporcionada voluntariamente por el usuario durante las interacciones. Estos datos son considerados datos personales sensibles, por lo que recibirán un tratamiento reforzado conforme a la legislación aplicable.</p>

          <p><strong>4. Finalidades del tratamiento</strong><br>
          Los datos personales serán utilizados para: Proporcionar acceso a la plataforma, Dar seguimiento al uso del sistema, Generar análisis mediante Inteligencia Artificial, Detectar patrones que permitan apoyar el bienestar emocional del usuario, Mejorar continuamente los modelos de Inteligencia Artificial y Desarrollar investigación científica y tecnológica. Cuando la información sea utilizada para investigación, ésta será previamente anonimizada o disociada, siempre que ello sea posible. Los datos personales no serán utilizados con fines comerciales.</p>

          <p><strong>5. Confidencialidad y seguridad</strong><br>
          La Universidad implementará medidas administrativas, técnicas y físicas razonables para proteger la información contra pérdida, alteración, acceso no autorizado, uso indebido o divulgación. Entre otras medidas podrán implementarse: Cifrado de comunicaciones, Control de acceso mediante autenticación, Registro de actividades, Copias de respaldo y Acceso restringido al personal autorizado.</p>

          <p><strong>6. Uso de Inteligencia Artificial</strong><br>
          La plataforma utiliza modelos de Inteligencia Artificial Generativa para apoyar diversas funciones como: análisis emocional; interacción conversacional; identificación de posibles factores de riesgo; y generación de recomendaciones generales. Las respuestas generadas por la Inteligencia Artificial son probabilísticas y pueden contener errores, omisiones o interpretaciones incorrectas. Por ello, no constituyen un diagnóstico clínico, no sustituyen la valoración de un profesional de la salud, y no deben utilizarse como única base para tomar decisiones relacionadas con la salud física o mental. Cuando la plataforma detecte indicadores de riesgo, podrá generar alertas para recomendar al usuario buscar atención profesional. Estas alertas constituyen únicamente mecanismos de apoyo y no garantizan la detección de todas las situaciones de riesgo.</p>

          <p><strong>7. Situaciones de emergencia</strong><br>
          Si el usuario presenta pensamientos suicidas, riesgo de autolesión, violencia, crisis emocional grave o cualquier situación que ponga en riesgo su integridad o la de terceros, deberá buscar atención inmediata mediante: servicios médicos de emergencia; líneas de atención en crisis; profesionales certificados en salud mental; o instituciones de salud correspondientes. La plataforma no ofrece atención psicológica de emergencia.</p>

          <p><strong>8. Transferencia de datos e integraciones externas</strong><br>
          Los datos personales no serán transferidos a terceros, salvo cuando exista consentimiento del titular, sea requerido por autoridad competente, la legislación aplicable así lo permita, o sea indispensable para proteger la vida o integridad del titular. Para su correcto funcionamiento, la plataforma utiliza servicios tecnológicos externos:
          <br>• <strong>Servicios de Seguridad y Verificación (CAPTCHA):</strong> Se utiliza un mecanismo de verificación de terceros (como Cloudflare Turnstile o Google reCAPTCHA) para proteger los formularios contra abusos y spam. Este servicio recopila telemetría del navegador, dirección IP y cookies para validar interacciones humanas. Se sugiere al usuario revisar la política de privacidad de dichos proveedores.
          <br>• <strong>Alojamiento en la Nube y Bases de Datos:</strong> La plataforma se apoya en servicios de infraestructura en la nube (como Supabase o Google Cloud) para el hosting de la aplicación y el almacenamiento seguro de las bases de datos. Por consiguiente, la información residirá físicamente en servidores de estos terceros proveedores.
          <br>• <strong>Procesamiento de Inteligencia Artificial (APIs):</strong> En caso de utilizar servicios tecnológicos externos para el procesamiento de Inteligencia Artificial, éstos deberán cumplir con las medidas de seguridad y confidencialidad aplicables.</p>

          <p><strong>9. Conservación de la información</strong><br>
          Los datos personales únicamente serán conservados durante el tiempo necesario para cumplir las finalidades descritas en este documento y las obligaciones legales aplicables. Concluido dicho periodo, la información será eliminada o anonimizada conforme a la normativa vigente.</p>

          <p><strong>10. Derechos ARCO</strong><br>
          El titular podrá ejercer en cualquier momento sus derechos de Acceso, Rectificación, Cancelación y Oposición. Asimismo, podrá solicitar la limitación del tratamiento o, cuando proceda, la revocación del consentimiento otorgado. Las solicitudes podrán realizarse mediante el correo electrónico de la Unidad de Transparencia de la BUAP y serán atendidas conforme a los plazos previstos por la legislación aplicable.</p>

          <p><strong>11. Consentimiento informado</strong><br>
          Al registrarse y utilizar esta plataforma, el usuario manifiesta que: Ha leído y comprendido el presente Aviso Integral de Privacidad; Conoce que la plataforma utiliza Inteligencia Artificial Generativa; Comprende que las respuestas emitidas por la Inteligencia Artificial constituyen únicamente una herramienta de apoyo; Autoriza el tratamiento de sus datos personales y datos personales sensibles para las finalidades descritas; Comprende que puede ejercer en cualquier momento sus derechos ARCO; y Acepta utilizar la plataforma de manera responsable.</p>

          <p><strong>12. Condiciones de uso</strong><br>
          La plataforma se encuentra actualmente en fase de investigación, validación tecnológica y mejora continua. En consecuencia, algunas funciones podrán modificarse, podrán existir interrupciones temporales del servicio, y podrán incorporarse nuevas funcionalidades derivadas del proceso de investigación. El usuario se compromete a utilizar la plataforma de manera ética, responsable y conforme a la legislación vigente.</p>

          <p><strong>13. Modificaciones</strong><br>
          El presente Aviso podrá actualizarse cuando existan cambios en la legislación, en el desarrollo tecnológico de la plataforma o en los procesos institucionales. Las modificaciones serán publicadas dentro de la propia plataforma.</p>

          <p><strong>14. Aceptación</strong><br>
          Al seleccionar la opción "He leído y acepto el Aviso Integral de Privacidad, el Consentimiento Informado y las Condiciones de Uso", el usuario manifiesta su consentimiento libre, informado y expreso para el tratamiento de sus datos personales conforme a lo establecido en este documento.</p>

          <p style="text-align: center; font-style: italic; margin-top: 1.5rem; color: var(--text-secondary);">"Innovación Tecnológica al Servicio del Bienestar Humano"</p>
        </div>
        <div class="modal-footer">
          <button (click)="onClose()" class="btn-primary">Cerrar y Entendido</button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./privacy-modal.component.scss'] 
})
export class PrivacyModalComponent {
  @Input() show = false;
  @Output() close = new EventEmitter<void>();

  onClose() {
    this.close.emit();
  }
}
