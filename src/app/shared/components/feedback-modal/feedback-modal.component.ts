import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

export interface FeedbackModalData {
  type: 'success' | 'error';
  title: string;
  message: string;
  btnText?: string;
}

@Component({
  selector: 'app-feedback-modal',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule],
  template: `
    <div class="feedback-container">
      <div class="icon-wrapper">
        <!-- Success Checkmark Animation -->
        <div *ngIf="data.type === 'success'" class="success-checkmark">
          <div class="check-icon">
            <span class="icon-line line-tip"></span>
            <span class="icon-line line-long"></span>
            <div class="icon-circle"></div>
            <div class="icon-fix"></div>
          </div>
        </div>

        <!-- Error Cross Animation -->
        <div *ngIf="data.type === 'error'" class="error-cross">
          <div class="cross-icon">
            <span class="icon-line line-left"></span>
            <span class="icon-line line-right"></span>
            <div class="icon-circle"></div>
          </div>
        </div>
      </div>

      <h2 class="title" [class.success]="data.type === 'success'" [class.error]="data.type === 'error'">
        {{ data.title }}
      </h2>
      
      <p class="message">{{ data.message }}</p>

      <button mat-flat-button 
              [class.btn-success]="data.type === 'success'"
              [class.btn-error]="data.type === 'error'"
              (click)="close()">
        {{ data.btnText || 'Aceptar' }}
      </button>
    </div>
  `,
  styles: [`
    .feedback-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px 24px;
      text-align: center;
      font-family: 'Inter', sans-serif;
    }

    .title {
      margin: 16px 0 8px;
      font-size: 1.5rem;
      font-weight: 600;
      &.success { color: #10b981; }
      &.error { color: #ef4444; }
    }

    .message {
      color: #64748b;
      font-size: 1rem;
      margin-bottom: 24px;
      line-height: 1.5;
    }

    button {
      padding: 8px 32px;
      font-size: 1rem;
      border-radius: 8px;
      font-weight: 600;
    }
    .btn-success { background: #10b981; color: white; }
    .btn-error { background: #ef4444; color: white; }

    /* Success Animation inspired by SweetAlert */
    .success-checkmark {
      width: 80px;
      height: 80px;
      margin: 0 auto;
      
      .check-icon {
        width: 80px;
        height: 80px;
        position: relative;
        border-radius: 50%;
        box-sizing: content-box;
        border: 4px solid rgba(16, 185, 129, 0.2);
        
        &::before {
          top: 3px;
          left: -2px;
          width: 30px;
          transform-origin: 100% 50%;
          border-radius: 100px 0 0 100px;
        }
        
        &::after {
          top: 0;
          left: 30px;
          width: 60px;
          transform-origin: 0 50%;
          border-radius: 0 100px 100px 0;
          animation: rotatePlaceholder 4.25s ease-in;
        }
        
        &::before, &::after {
          content: '';
          height: 100px;
          position: absolute;
          background: white;
          transform: rotate(-45deg);
        }
        
        .icon-line {
          height: 5px;
          background-color: #10b981;
          display: block;
          border-radius: 2px;
          position: absolute;
          z-index: 10;
          
          &.line-tip {
            top: 46px;
            left: 14px;
            width: 25px;
            transform: rotate(45deg);
            animation: icon-line-tip 0.75s;
          }
          
          &.line-long {
            top: 38px;
            right: 8px;
            width: 47px;
            transform: rotate(-45deg);
            animation: icon-line-long 0.75s;
          }
        }
        
        .icon-circle {
          top: -4px;
          left: -4px;
          z-index: 10;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          position: absolute;
          box-sizing: content-box;
          border: 4px solid rgba(16, 185, 129, 1);
        }
        
        .icon-fix {
          top: 8px;
          width: 5px;
          left: 26px;
          z-index: 1;
          height: 85px;
          position: absolute;
          transform: rotate(-45deg);
          background-color: white;
        }
      }
    }

    /* Error Animation */
    .error-cross {
      width: 80px;
      height: 80px;
      margin: 0 auto;

      .cross-icon {
        width: 80px;
        height: 80px;
        position: relative;
        border-radius: 50%;
        box-sizing: content-box;
        border: 4px solid rgba(239, 68, 68, 0.2);
        
        .icon-circle {
          top: -4px;
          left: -4px;
          z-index: 10;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          position: absolute;
          box-sizing: content-box;
          border: 4px solid rgba(239, 68, 68, 1);
        }

        .icon-line {
          position: absolute;
          height: 5px;
          width: 47px;
          background-color: #ef4444;
          display: block;
          top: 37px;
          border-radius: 2px;
          z-index: 10;
          
          &.line-left {
            left: 17px;
            transform: rotate(45deg);
            animation: icon-line-left 0.5s;
          }
          
          &.line-right {
            right: 16px;
            transform: rotate(-45deg);
            animation: icon-line-right 0.5s;
          }
        }
      }
    }

    @keyframes icon-line-tip {
      0% { width: 0; left: 1px; top: 19px; }
      54% { width: 0; left: 1px; top: 19px; }
      70% { width: 50px; left: -8px; top: 37px; }
      84% { width: 17px; left: 21px; top: 48px; }
      100% { width: 25px; left: 14px; top: 46px; }
    }

    @keyframes icon-line-long {
      0% { width: 0; right: 46px; top: 54px; }
      65% { width: 0; right: 46px; top: 54px; }
      84% { width: 55px; right: 0px; top: 35px; }
      100% { width: 47px; right: 8px; top: 38px; }
    }
    
    @keyframes icon-line-left {
      0% { width: 0; left: 40px; top: 40px; }
      50% { width: 0; left: 40px; top: 40px; }
      100% { width: 47px; left: 17px; top: 37px; }
    }
    @keyframes icon-line-right {
      0% { width: 0; right: 40px; top: 40px; }
      50% { width: 0; right: 40px; top: 40px; }
      100% { width: 47px; right: 16px; top: 37px; }
    }
  `]
})
export class FeedbackModalComponent {
  constructor(
    public dialogRef: MatDialogRef<FeedbackModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FeedbackModalData
  ) {}

  close(): void {
    this.dialogRef.close(true);
  }
}
