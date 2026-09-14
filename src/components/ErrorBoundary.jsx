import { Component } from 'react';

// Хваща грешки при рендиране, за да не остава бял екран без никаква следа.
// Показва съобщението + stack, за да може да се прочете директно на телефона.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-400 via-teal-300 to-emerald-300 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
          <h1 className="text-xl font-bold text-red-600 mb-2">⚠️ Възникна грешка</h1>
          <p className="text-gray-600 mb-4">
            Приложението не успя да се зареди. Данните ти в IndexedDB не са засегнати.
            Изпрати текста по-долу, за да се оправи причината.
          </p>
          <pre className="bg-gray-100 rounded-xl p-3 text-xs text-gray-800 overflow-auto max-h-60 whitespace-pre-wrap">
            {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
            {this.state.info?.componentStack ?? ''}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg"
          >
            Презареди
          </button>
        </div>
      </div>
    );
  }
}
