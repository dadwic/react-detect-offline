import { Component, isValidElement, Children, createElement } from "react";

const inBrowser = typeof navigator !== "undefined";

// these browsers don't fully support navigator.onLine, so we need to use a polling backup
const unsupportedUserAgentsPattern = /Windows.*Chrome|Windows.*Firefox|Linux.*Chrome/;

const ping = (req: { url: string; timeout: number }): Promise<boolean> => {
	return new Promise<boolean>((resolve, reject) => {
		const isOnline = () => resolve(true);
		const isOffline = () => resolve(false);

		const xhr = new XMLHttpRequest();

		xhr.onerror = isOffline;
		xhr.ontimeout = isOffline;
		xhr.onreadystatechange = () => {
			if (xhr.readyState === xhr.HEADERS_RECEIVED) {
				if (xhr.status) {
					isOnline();
				} else {
					isOffline();
				}
			}
		};

		xhr.open("HEAD", req.url);
		xhr.timeout = req.timeout;
		xhr.send();
	});
};

const defaultPollingConfig = {
	enabled: inBrowser && unsupportedUserAgentsPattern.test(navigator.userAgent),
	url: "https://ipv4.icanhazip.com/",
	timeout: 5000,
	interval: 5000,
};

interface IProps {
	superhero?: string;
	children?: React.ReactNode;
	onChange?: (online: boolean) => void;
	render?: (data: { online: boolean }) => JSX.Element;
	polling?:
		| {
				url: string;
				interval: number;
				timeout: number;
		  }
		| boolean;
	wrapperType?: string;
}

interface IState {
	online: boolean;
	pollingId?: NodeJS.Timeout;
}

// base class that detects offline/online changes
class Base extends Component<IProps, IState> {
	static defaultProps = {
		polling: true,
		wrapperType: "span",
	};

	constructor(props: IProps) {
		super(props);
		this.state = {
			online: inBrowser && typeof navigator.onLine === "boolean" ? navigator.onLine : true,
		};
		// bind event handlers
		this.goOnline = this.goOnline.bind(this);
		this.goOffline = this.goOffline.bind(this);
	}

	componentDidMount() {
		window.addEventListener("online", this.goOnline);
		window.addEventListener("offline", this.goOffline);

		if (this.getPollingConfig().enabled) {
			this.startPolling();
		}
	}

	componentWillUnmount() {
		window.removeEventListener("online", this.goOnline);
		window.removeEventListener("offline", this.goOffline);

		if (this.state.pollingId) {
			this.stopPolling();
		}
	}

	renderChildren(): any {
		const { children, wrapperType } = this.props;

		// usual case: one child that is a react Element
		if (isValidElement(children)) {
			return children;
		}

		// no children
		if (!children) {
			return null;
		}

		// string children, multiple children, or something else
		if (wrapperType) {
			return createElement(wrapperType, {}, ...Children.toArray(children));
		}
	}

	getPollingConfig() {
		switch (this.props.polling) {
			case true:
				return defaultPollingConfig;
			case false:
				return Object.assign({}, defaultPollingConfig, { enabled: false });
			default:
				return Object.assign({}, defaultPollingConfig, this.props.polling);
		}
	}

	goOnline() {
		if (!this.state.online) {
			this.callOnChangeHandler(true);
			this.setState({ online: true });
		}
	}

	goOffline() {
		if (this.state.online) {
			this.callOnChangeHandler(false);
			this.setState({ online: false });
		}
	}

	callOnChangeHandler(online: boolean) {
		if (this.props.onChange) {
			this.props.onChange(online);
		}
	}

	startPolling() {
		const { interval } = this.getPollingConfig();
		this.setState({
			pollingId: setInterval(() => {
				const { url, timeout } = this.getPollingConfig();
				ping({ url, timeout }).then(online => {
					online ? this.goOnline() : this.goOffline();
				});
			}, interval),
		});
	}

	stopPolling() {
		if (this.state.pollingId) {
			clearInterval(this.state.pollingId);
		}
	}
}

export class Online extends Base {
	render() {
		return this.state.online ? this.renderChildren() : null;
	}
}

export class Offline extends Base {
	render() {
		return !this.state.online ? this.renderChildren() : null;
	}
}

export class Detector extends Base {
	render() {
		if (this.props.render) {
			return this.props.render({ online: this.state.online });
		}

		return null;
	}
}
