/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Kyvora. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IKyvoraCollaborationService } from '../common/kyvoraCollaborationService.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';

export class KyvoraLoginInitializer extends Disposable implements IWorkbenchContribution {
	private overlay: HTMLDivElement | null = null;
	private styleEl: HTMLStyleElement | null = null;

	constructor(
		@IKyvoraCollaborationService private readonly collabService: IKyvoraCollaborationService
	) {
		super();
		this.checkLoginStatus();
		this._register(CommandsRegistry.registerCommand('kyvora.showLogin', () => {
			this.showLoginOverlay();
		}));
	}

	private checkLoginStatus(): void {
		if (!this.collabService.isLoggedIn()) {
			this.showLoginOverlay();
		}
	}

	private showLoginOverlay(): void {
		if (this.overlay) {
			return;
		}

		// Inject custom styling
		this.styleEl = document.createElement('style');
		this.styleEl.textContent = `
			@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');

			.kyvora-login-overlay {
				position: fixed;
				top: 0;
				left: 0;
				width: 100vw;
				height: 100vh;
				z-index: 999999;
				display: flex;
				align-items: center;
				justify-content: center;
				font-family: 'Outfit', sans-serif;
				color: #f3f4f6;
				overflow: hidden;
				user-select: none;
			}

			/* Moving Mesh Gradient Background */
			.kyvora-login-bg {
				position: absolute;
				top: -50%;
				left: -50%;
				right: -50%;
				bottom: -50%;
				width: 200%;
				height: 200%;
				background: radial-gradient(circle at 30% 30%, #1e1b4b 0%, #030712 50%),
				            radial-gradient(circle at 80% 80%, #311042 0%, #030712 50%),
				            radial-gradient(circle at 50% 20%, #0f172a 0%, #030712 70%);
				background-blend-mode: screen;
				animation: bg-spin 25s linear infinite;
				z-index: -2;
			}

			@keyframes bg-spin {
				0% { transform: rotate(0deg); }
				100% { transform: rotate(360deg); }
			}

			/* Glowing Ambient Orb */
			.kyvora-login-orb {
				position: absolute;
				width: 600px;
				height: 600px;
				background: radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, rgba(13, 148, 136, 0.05) 50%, rgba(0,0,0,0) 70%);
				top: calc(50% - 300px);
				left: calc(50% - 300px);
				z-index: -1;
				filter: blur(40px);
				animation: orb-pulse 8s ease-in-out infinite alternate;
			}

			@keyframes orb-pulse {
				0% { transform: scale(0.9); opacity: 0.8; }
				100% { transform: scale(1.1); opacity: 1.2; }
			}

			/* Card with Glassmorphism */
			.kyvora-auth-card {
				background: rgba(10, 10, 15, 0.65);
				backdrop-filter: blur(25px);
				-webkit-backdrop-filter: blur(25px);
				border: 1px solid rgba(255, 255, 255, 0.08);
				border-radius: 24px;
				width: 420px;
				padding: 40px;
				box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5),
				            inset 0 1px 2px rgba(255, 255, 255, 0.1);
				position: relative;
				transform: translateY(0);
				transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
				display: flex;
				flex-direction: column;
				align-items: center;
			}

			.kyvora-auth-card:hover {
				border-color: rgba(0, 183, 255, 0.2);
				box-shadow: 0 20px 60px rgba(0, 183, 255, 0.05),
				            0 20px 50px rgba(0, 0, 0, 0.6),
				            inset 0 1px 2px rgba(255, 255, 255, 0.15);
			}

			/* Header & Branding */
			.kyvora-auth-header {
				text-align: center;
				margin-bottom: 30px;
				display: flex;
				flex-direction: column;
				align-items: center;
				width: 100%;
			}

			.kyvora-auth-logo-container {
				width: 72px;
				height: 72px;
				margin-bottom: 16px;
				position: relative;
				filter: drop-shadow(0 4px 12px rgba(0, 183, 255, 0.2));
			}

			.kyvora-auth-title {
				font-size: 26px;
				font-weight: 600;
				letter-spacing: -0.5px;
				background: linear-gradient(135deg, #ffffff 0%, #a5b4fc 100%);
				-webkit-background-clip: text;
				-webkit-text-fill-color: transparent;
				margin-bottom: 8px;
			}

			.kyvora-auth-subtitle {
				font-size: 14px;
				color: #9ca3af;
				font-weight: 400;
			}

			/* Form Controls */
			.kyvora-auth-form {
				width: 100%;
				display: flex;
				flex-direction: column;
				gap: 18px;
			}

			.kyvora-auth-group {
				display: flex;
				flex-direction: column;
				gap: 6px;
				width: 100%;
			}

			.kyvora-auth-label {
				font-size: 13px;
				font-weight: 500;
				color: #d1d5db;
				letter-spacing: 0.2px;
			}

			.kyvora-auth-input {
				background: rgba(255, 255, 255, 0.03);
				border: 1px solid rgba(255, 255, 255, 0.08);
				border-radius: 12px;
				padding: 12px 16px;
				font-family: inherit;
				font-size: 14px;
				color: #f3f4f6;
				outline: none;
				transition: all 0.2s ease;
			}

			.kyvora-auth-input:focus {
				border-color: rgba(0, 183, 255, 0.8);
				background: rgba(0, 183, 255, 0.02);
				box-shadow: 0 0 0 4px rgba(0, 183, 255, 0.15);
			}

			.kyvora-auth-input::placeholder {
				color: #6b7280;
			}

			/* Buttons & Actions */
			.kyvora-auth-submit {
				background: linear-gradient(135deg, #007ACC 0%, #00D2FF 100%);
				border: none;
				border-radius: 12px;
				padding: 14px;
				font-family: inherit;
				font-size: 14px;
				font-weight: 600;
				color: #ffffff;
				cursor: pointer;
				transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
				box-shadow: 0 4px 12px rgba(0, 183, 255, 0.2);
				position: relative;
				overflow: hidden;
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.kyvora-auth-submit:hover {
				transform: translateY(-1px);
				box-shadow: 0 6px 20px rgba(0, 183, 255, 0.3);
				background: linear-gradient(135deg, #0087e0 0%, #1ad6ff 100%);
			}

			.kyvora-auth-submit:active {
				transform: translateY(1px);
				box-shadow: 0 2px 8px rgba(0, 183, 255, 0.2);
			}

			/* Loading state */
			.kyvora-auth-submit.loading {
				color: transparent;
				pointer-events: none;
			}

			.kyvora-auth-submit.loading::after {
				content: "";
				position: absolute;
				width: 18px;
				height: 18px;
				border: 2px solid rgba(255, 255, 255, 0.3);
				border-radius: 50%;
				border-top-color: #ffffff;
				animation: spin 0.8s ease-in-out infinite;
			}

			@keyframes spin {
				to { transform: rotate(360deg); }
			}

			/* Toggle Link */
			.kyvora-auth-footer {
				margin-top: 24px;
				font-size: 13px;
				color: #9ca3af;
				display: flex;
				flex-direction: column;
				gap: 12px;
				align-items: center;
				width: 100%;
			}

			.kyvora-auth-link {
				color: #00B7FF;
				text-decoration: none;
				font-weight: 500;
				cursor: pointer;
				transition: color 0.2s ease;
			}

			.kyvora-auth-link:hover {
				color: #00D2FF;
				text-decoration: underline;
			}

			.kyvora-guest-link {
				font-size: 12px;
				color: #6b7280;
				cursor: pointer;
				transition: color 0.2s ease;
			}

			.kyvora-guest-link:hover {
				color: #9ca3af;
			}

			/* Alerts & Feedback */
			.kyvora-auth-alert {
				width: 100%;
				padding: 12px 16px;
				border-radius: 12px;
				font-size: 13px;
				line-height: 1.4;
				box-sizing: border-box;
				display: none;
			}

			.kyvora-auth-alert.error {
				display: block;
				background: rgba(239, 68, 68, 0.1);
				border: 1px solid rgba(239, 68, 68, 0.2);
				color: #fca5a5;
			}

			.kyvora-auth-alert.success {
				display: block;
				background: rgba(16, 185, 129, 0.1);
				border: 1px solid rgba(16, 185, 129, 0.2);
				color: #a7f3d0;
			}

			/* Fade & Slide Transitions */
			.fade-out {
				opacity: 0;
				transform: scale(0.95) translateY(10px);
			}

			.fade-in {
				animation: card-appear 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
			}

			@keyframes card-appear {
				from { opacity: 0; transform: scale(0.95) translateY(10px); }
				to { opacity: 1; transform: scale(1) translateY(0); }
			}
		`;
		document.head.appendChild(this.styleEl);

		// Create DOM structure
		this.overlay = document.createElement('div');
		this.overlay.className = 'kyvora-login-overlay';
		this.overlay.innerHTML = `
			<div class="kyvora-login-bg"></div>
			<div class="kyvora-login-orb"></div>
			<div class="kyvora-auth-card fade-in" id="authCard">
				<div class="kyvora-auth-header">
					<div class="kyvora-auth-logo-container">
						<svg viewBox="0 0 500 500" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%;">
							<defs>
								<linearGradient id="overlayBlueGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
									<stop offset="0%" stop-color="#005FB8" />
									<stop offset="100%" stop-color="#00B7FF" />
								</linearGradient>
								<linearGradient id="overlayBlueGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
									<stop offset="0%" stop-color="#00D2FF" />
									<stop offset="100%" stop-color="#007ACC" />
								</linearGradient>
								<filter id="overlay-glow-filter" x="-20%" y="-20%" width="140%" height="140%">
									<feGaussianBlur stdDeviation="15" result="blur" />
									<feComposite in="SourceGraphic" in2="blur" operator="over" />
								</filter>
							</defs>
							<circle cx="250" cy="250" r="235" stroke="rgba(0, 183, 255, 0.1)" stroke-width="4" stroke-dasharray="10 15" fill="none" />
							<circle cx="250" cy="250" r="215" stroke="rgba(0, 183, 255, 0.05)" stroke-width="2" fill="none" />
							<g fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#overlay-glow-filter)">
								<path d="M 120,80 L 120,420" stroke="url(#overlayBlueGrad1)" stroke-width="45" />
								<path d="M 320,100 L 400,180 L 400,320 L 320,400" stroke="url(#overlayBlueGrad2)" stroke-width="35" />
								<path d="M 130,250 L 340,90" stroke="url(#overlayBlueGrad2)" stroke-width="40" />
								<path d="M 130,250 L 340,410" stroke="url(#overlayBlueGrad1)" stroke-width="40" />
								<path d="M 150,250 C 150,190 240,190 280,250 C 320,310 410,310 410,250 C 410,190 320,190 280,250 C 240,310 150,310 150,250 Z" stroke="url(#overlayBlueGrad2)" stroke-width="30" />
							</g>
							<circle cx="250" cy="250" r="14" fill="#FFFFFF" style="filter: drop-shadow(0px 0px 10px rgba(0, 210, 255, 0.9));" />
						</svg>
					</div>
					<div class="kyvora-auth-title" id="cardTitle">Sign In to Kyvora</div>
					<div class="kyvora-auth-subtitle" id="cardSubtitle">Access the collaboration hub and AI services</div>
				</div>

				<div class="kyvora-auth-alert" id="authAlert"></div>

				<form class="kyvora-auth-form" id="authForm" onsubmit="return false;">
					<!-- Form fields will be dynamically modified -->
					<div class="kyvora-auth-group">
						<label class="kyvora-auth-label" for="usernameInput">Username</label>
						<input class="kyvora-auth-input" type="text" id="usernameInput" placeholder="Enter your username" required autocomplete="username">
					</div>
					<div class="kyvora-auth-group" id="emailGroup" style="display: none;">
						<label class="kyvora-auth-label" for="emailInput">Email Address</label>
						<input class="kyvora-auth-input" type="email" id="emailInput" placeholder="Enter your email">
					</div>
					<div class="kyvora-auth-group">
						<label class="kyvora-auth-label" for="passwordInput">Password</label>
						<input class="kyvora-auth-input" type="password" id="passwordInput" placeholder="••••••••" required autocomplete="current-password">
					</div>

					<button class="kyvora-auth-submit" type="submit" id="submitBtn">Sign In</button>
				</form>

				<div class="kyvora-auth-footer">
					<span id="switchText">Need an account? <a class="kyvora-auth-link" id="switchLink">Sign Up</a></span>
					<a class="kyvora-guest-link" id="guestLink">Continue as guest / offline</a>
				</div>
			</div>
		`;

		document.body.appendChild(this.overlay);
		this.registerOverlayEvents();
	}

	private registerOverlayEvents(): void {
		if (!this.overlay) { return; }

		const card = this.overlay.querySelector('#authCard') as HTMLDivElement;
		const title = this.overlay.querySelector('#cardTitle') as HTMLDivElement;
		const subtitle = this.overlay.querySelector('#cardSubtitle') as HTMLDivElement;
		const form = this.overlay.querySelector('#authForm') as HTMLFormElement;
		const emailGroup = this.overlay.querySelector('#emailGroup') as HTMLDivElement;
		const emailInput = this.overlay.querySelector('#emailInput') as HTMLInputElement;
		const submitBtn = this.overlay.querySelector('#submitBtn') as HTMLButtonElement;
		const switchLink = this.overlay.querySelector('#switchLink') as HTMLAnchorElement;
		const switchText = this.overlay.querySelector('#switchText') as HTMLSpanElement;
		const guestLink = this.overlay.querySelector('#guestLink') as HTMLAnchorElement;
		const alertEl = this.overlay.querySelector('#authAlert') as HTMLDivElement;

		const usernameInput = this.overlay.querySelector('#usernameInput') as HTMLInputElement;
		const passwordInput = this.overlay.querySelector('#passwordInput') as HTMLInputElement;

		let mode: 'login' | 'signup' = 'login';

		const showAlert = (message: string, type: 'error' | 'success') => {
			alertEl.className = `kyvora-auth-alert ${type}`;
			alertEl.textContent = message;
		};

		const hideAlert = () => {
			alertEl.className = 'kyvora-auth-alert';
			alertEl.textContent = '';
		};

		// Switch Mode between Login and Signup
		switchLink.onclick = () => {
			card.classList.add('fade-out');

			setTimeout(() => {
				hideAlert();
				usernameInput.value = '';
				passwordInput.value = '';
				emailInput.value = '';

				if (mode === 'login') {
					mode = 'signup';
					title.textContent = 'Create Account';
					subtitle.textContent = 'Register to synchronize workspaces';
					emailGroup.style.display = 'flex';
					emailInput.required = true;
					submitBtn.textContent = 'Sign Up';
					switchText.innerHTML = `Have an account? <a class="kyvora-auth-link" id="innerSwitchLink">Sign In</a>`;
					
					const innerSwitchLink = this.overlay!.querySelector('#innerSwitchLink') as HTMLAnchorElement;
					innerSwitchLink.onclick = switchLink.onclick;
				} else {
					mode = 'login';
					title.textContent = 'Sign In to Kyvora';
					subtitle.textContent = 'Access the collaboration hub and AI services';
					emailGroup.style.display = 'none';
					emailInput.required = false;
					submitBtn.textContent = 'Sign In';
					switchText.innerHTML = `Need an account? <a class="kyvora-auth-link" id="innerSwitchLink">Sign Up</a>`;

					const innerSwitchLink = this.overlay!.querySelector('#innerSwitchLink') as HTMLAnchorElement;
					innerSwitchLink.onclick = switchLink.onclick;
				}

				card.classList.remove('fade-out');
			}, 300);
		};

		// Guest Mode / Offline Bypass
		guestLink.onclick = () => {
			this.dismissOverlay();
		};

		// Submit Form
		form.onsubmit = async (e) => {
			e.preventDefault();
			hideAlert();

			const username = usernameInput.value.trim();
			const password = passwordInput.value;

			if (!username || !password) {
				showAlert('Please fill in all required fields.', 'error');
				return;
			}

			submitBtn.classList.add('loading');
			usernameInput.disabled = true;
			passwordInput.disabled = true;
			emailInput.disabled = true;

			try {
				if (mode === 'login') {
					const success = await this.collabService.login(username, password);
					if (success) {
						this.dismissOverlay();
					} else {
						showAlert('Invalid username or password. Please try again.', 'error');
						submitBtn.classList.remove('loading');
						usernameInput.disabled = false;
						passwordInput.disabled = false;
						emailInput.disabled = false;
					}
				} else {
					const email = emailInput.value.trim();
					if (!email) {
						showAlert('Please enter a valid email address.', 'error');
						submitBtn.classList.remove('loading');
						usernameInput.disabled = false;
						passwordInput.disabled = false;
						emailInput.disabled = false;
						return;
					}

					const success = await this.collabService.signup(username, email, password);
					if (success) {
						showAlert('Account created successfully! Please sign in.', 'success');
						// Automatically flip to login mode
						setTimeout(() => {
							switchLink.click();
						}, 1500);
					} else {
						showAlert('Signup failed. Username or email may already be registered.', 'error');
					}
					submitBtn.classList.remove('loading');
					usernameInput.disabled = false;
					passwordInput.disabled = false;
					emailInput.disabled = false;
				}
			} catch (err) {
				console.error(err);
				showAlert('An unexpected connection error occurred.', 'error');
				submitBtn.classList.remove('loading');
				usernameInput.disabled = false;
				passwordInput.disabled = false;
				emailInput.disabled = false;
			}
		};
	}

	private dismissOverlay(): void {
		if (!this.overlay) { return; }

		// Add fade-out classes to everything
		const card = this.overlay.querySelector('#authCard') as HTMLDivElement;
		if (card) {
			card.style.transform = 'scale(0.9) translateY(-30px)';
			card.style.opacity = '0';
		}
		this.overlay.style.transition = 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
		this.overlay.style.opacity = '0';
		this.overlay.style.pointerEvents = 'none';

		setTimeout(() => {
			if (this.overlay && this.overlay.parentNode) {
				this.overlay.parentNode.removeChild(this.overlay);
			}
			if (this.styleEl && this.styleEl.parentNode) {
				this.styleEl.parentNode.removeChild(this.styleEl);
			}
			this.overlay = null;
			this.styleEl = null;
		}, 600);
	}

	override dispose(): void {
		if (this.overlay && this.overlay.parentNode) {
			this.overlay.parentNode.removeChild(this.overlay);
		}
		if (this.styleEl && this.styleEl.parentNode) {
			this.styleEl.parentNode.removeChild(this.styleEl);
		}
		super.dispose();
	}
}
