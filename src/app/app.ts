import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import {
  trigger,
  transition,
  style,
  animate,
  query
} from '@angular/animations'

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  animations: [
    trigger('routeAnimations', [
      transition('* <=> *', [
        query(':enter, :leave', [
          style({
            position: 'absolute',
            width: '100%'
          })
        ], { optional: true }),

        query(':leave', [
          animate('200ms ease',
            style({ opacity: 0, transform: 'translateY(-10px)' })
          )
        ], { optional: true }),

        query(':enter', [
          style({ opacity: 0, transform: 'translateY(10px)' }),
          animate('200ms ease',
            style({ opacity: 1, transform: 'translateY(0)' })
          )
        ], { optional: true })

      ])
    ])
  ]

})
export class App {
  protected readonly title = signal('Plataforma_Emocional');

  prepareRoute(outlet: any) {
    return outlet?.activatedRouteData?.['animation'];
  }
}
