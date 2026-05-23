import { RegexService } from './content/RegexService';
import { TitleService } from './content/TitleService';
import { IconService } from './content/IconService';
import { StorageService } from './content/StorageService';
import { RuleApplicationService } from './content/RuleApplicationService';
import { SpotSearchUI } from './content/SpotSearchUI';
import { UrlChangeDetector } from './content/UrlChangeDetector';

import {
	debugLog,
	initDebugMode,
} from './content/debugLog';

class ContentApp {
	private regexService: RegexService;
	private titleService: TitleService;
	private iconService: IconService;
	private storageService: StorageService;
	private ruleService: RuleApplicationService;
	private spotSearchUI: SpotSearchUI;
	private urlDetector: UrlChangeDetector;

	constructor() {
		this.regexService = new RegexService();

		this.titleService = new TitleService(
			this.regexService
		);

		this.iconService = new IconService();

		this.storageService = new StorageService(
			this.regexService
		);

		this.ruleService =
			new RuleApplicationService(
				this.titleService,
				this.iconService
			);

		this.spotSearchUI = new SpotSearchUI();

		this.urlDetector =
			new UrlChangeDetector();
	}

	async initialize(): Promise<void> {
		try {
			await this.initializeDebugMode();

			this.initializeSpotSearch();

			this.setupUrlDetection();

			this.setupMessageListeners();

			await this.applyRules(location.href);

			debugLog(
				'[Tabee] ✅ Content app initialized'
			);

		} catch (error) {
			console.error(
				'[Tabee] Failed initializing app:',
				error
			);
		}
	}

	private async initializeDebugMode() {
		await initDebugMode();

		debugLog(
			'[Tabee] 🛠 Debug mode initialized'
		);
	}

	private initializeSpotSearch() {
		try {
			this.spotSearchUI.init();

			debugLog(
				'[Tabee] 🔍 Spot Search initialized'
			);

		} catch (error) {
			console.error(
				'[Tabee] Spot Search failed:',
				error
			);
		}
	}

	private setupUrlDetection() {
		this.urlDetector.onChange(
			async (newUrl, oldUrl) => {
				debugLog(
					'[Tabee] 🔄 URL changed',
					{
						oldUrl,
						newUrl,
					}
				);

				await this.applyRules(newUrl);
			}
		);

		this.urlDetector.start();
	}

	private async applyRules(
		url: string
	): Promise<void> {
		try {
			const rule =
				await this.storageService.getRuleFromUrl(
					url
				);

			if (!rule) {
				debugLog(
					'[Tabee] No matching rule found'
				);

				return;
			}

			debugLog(
				'[Tabee] 📋 Applying rule:',
				url
			);

			await this.ruleService.applyRule(rule);

		} catch (error) {
			console.error(
				'[Tabee] Failed applying rule:',
				error
			);
		}
	}

	private setupMessageListeners() {
		chrome.runtime.onMessage.addListener(
			(request) => {
				this.handleMessage(request);

				return true;
			}
		);
	}

	private async handleMessage(
		request: RuntimeMessage
	): Promise<void> {
		try {
			switch (request.action) {
				case 'openPrompt':
					return this.handleOpenPrompt();

				case 'applyRule':
					return this.ruleService.applyRule(
						request.rule,
						false
					);

				case 'ungroupTab':
					return chrome.tabs.ungroup(
						request.tabId
					);

				case 'toggleSpotSearch':
					return this.toggleSpotSearch();

				case 'spotSearchResults':
					return this.showSpotSearchResults(
						request.tabs,
						request.bookmarks
					);

				default:
					debugLog(
						'[Tabee] Unknown message:',
						request
					);
			}

		} catch (error) {
			console.error(
				'[Tabee] Message handling failed:',
				error
			);
		}
	}

	private async handleOpenPrompt() {
		const title = prompt(
			'Enter the new title'
		);

		if (!title) return;

		await chrome.runtime.sendMessage({
			action: 'renameTab',
			title,
		});
	}

	private toggleSpotSearch() {
		debugLog(
			'[Tabee] 🔍 Toggling Spot Search'
		);

		this.spotSearchUI.toggle();
	}

	private showSpotSearchResults(
		tabs: unknown[],
		bookmarks: unknown[]
	) {
		debugLog(
			'[Tabee] 📑 Rendering search results',
			{
				tabs: tabs.length,
				bookmarks: bookmarks.length,
			}
		);

		this.spotSearchUI.displayResults(
			tabs,
			bookmarks
		);
	}

	destroy() {
		this.urlDetector.stop?.();

		debugLog(
			'[Tabee] 🧹 Content app destroyed'
		);
	}
}

type RuntimeMessage =
	| {
			action: 'openPrompt';
	  }
	| {
			action: 'applyRule';
			rule: unknown;
	  }
	| {
			action: 'ungroupTab';
			tabId: number;
	  }
	| {
			action: 'toggleSpotSearch';
	  }
	| {
			action: 'spotSearchResults';
			tabs: unknown[];
			bookmarks: unknown[];
	  };

const app = new ContentApp();

app.initialize();

window.addEventListener('beforeunload', () => {
	app.destroy();
});
