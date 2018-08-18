import { Component } from '@angular/core';
import { filter } from 'rxjs/operators';
import { OAuthService, AuthConfig, OAuthErrorEvent } from 'angular-oauth2-oidc';

@Component({
  selector: 'app-root',
  template: `<div class="container-fluid">
    <app-menu></app-menu>
    <div class="container-fluid mt-2">
      <h1>Welcome</h1>
      <p>This is part of the app.component. Below is the router outlet.</p>
      <hr><router-outlet></router-outlet>
      <hr><p>You can <a routerLink="/url-without-route">go to a url without a route</a> to see the fallback route.</p>
      <hr>
      <p>
        <button class="btn btn-success mr-1" (click)='login()'>login</button>
        <button class="btn btn-primary mr-4" (click)='logoff()'>logout</button>
        <button class="btn btn-warning mr-4" (click)='refresh()'>force silent refresh</button>
        <button class="btn btn-secondary mr-4" (click)='reload()'>force reload page</button>
        <button class="btn btn-danger mr-1" (click)='reset()'>reset everything locally</button>
      </p>
      <hr>
      <strong>AccessToken</strong><pre>{{accessToken}}</pre>
      <strong>IdToken</strong><pre>{{idToken}}</pre>
      <strong>IdentityClaims</strong><pre>{{identityClaims | json}}</pre>
    </div>
  </div>`,
})
export class AppComponent {
  constructor (
    private authService: OAuthService,
    private authConfig: AuthConfig,
  ) {
    this.authService.events.subscribe(event => {
      if (event instanceof OAuthErrorEvent) {
        console.error(event);
      } else {
        console.warn(event);
      }
    });

    this.authService.configure(authConfig);

    this.authService.events
      .pipe(filter(e => e.type === 'token_received'))
      .subscribe(e => this.authService.loadUserProfile());

    this.authService.setupAutomaticSilentRefresh();

    // 0. LOAD CONFIG:
    // First we have to check to see how the IdServer is
    // currently configured:
    this.authService.loadDiscoveryDocument()

      // 1. HASH LOGIN:
      // Try to log in via hash fragment after redirect back
      // from IdServer from initImplicitFlow:
      .then(() => this.authService.tryLogin())

      .then(tryLoginResult => {
        if (this.authService.hasValidAccessToken()) {
          return tryLoginResult;
        }

        // 2. SILENT LOGIN:
        // Try to log in via silent refresh because the IdServer
        // might have a cookie to remember the user, so we can
        // prevent doing a redirect:
        return this.authService.silentRefresh()
          .catch(result => {
            // Subset of situations from https://openid.net/specs/openid-connect-core-1_0.html#AuthError
            // Only the ones where it's reasonably sure that sending the
            // user to the IdServer will help.
            const errorResponsesRequiringUserInteraction = [
              'interaction_required',
              'login_required',
              'account_selection_required',
              'consent_required',
            ];

            if (result
              && result.reason
              && errorResponsesRequiringUserInteraction.indexOf(result.reason.error) >= 0) {

              // 3. ASK FOR LOGIN:
              // At this point we know for sure that we have to ask the
              // user to log in, so we redirect them to the IdServer to
              // enter credentials:
              this.authService.initImplicitFlow();

              // Just in case initImplicitFlow ever turns out to be(come) async.
              return Promise.resolve();
            }

            // We can't handle the truth, just pass on the problem to the
            // next handler.
            return Promise.reject(result);
          });
      });
  }

  public login() { this.authService.initImplicitFlow(); }
  public logoff() { this.authService.logOut(); }
  public refresh() { this.authService.silentRefresh(); }
  public reload() { window.location.reload(); }

  public reset() {
    localStorage.clear();
    this.reload();
  }

  public get accessToken() { return this.authService.getAccessToken(); }
  public get identityClaims() { return this.authService.getIdentityClaims(); }
  public get idToken() { return this.authService.getIdToken(); }
}
