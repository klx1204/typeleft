import React from "react";
import { remote } from "services/remote";
import { t } from "services/i18n";

class ErrorBoundary extends React.Component {

    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, info: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        this.setState({ info });
        remote.unhandledException(error + '\n\n' + JSON.stringify(info));
    }

    render() {
        if (this.state.hasError) {
            const err = this.state.error;
            return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
                <h2 style={{ color: '#c00' }}>{t('Editor Error')}</h2>
                <p style={{ color: '#c33', fontWeight: 'bold', fontSize: 13 }}>{err?.toString()}</p>
                <pre style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 16, borderRadius: 4, fontSize: 14, lineHeight: 1.5 }}>{err?.stack || err?.toString()}</pre>
                {this.state.info && <pre style={{ whiteSpace: 'pre-wrap', color: '#666', fontSize: 12, marginTop: 8 }}>{t('Component Stack')}: {this.state.info.componentStack}</pre>}
            </div>;
        }
        return this.props.children;
    }
}

export default ErrorBoundary