import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      message: 'Something went wrong.',
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || 'Something went wrong.',
    };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught an error:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: 'Something went wrong.' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Unexpected App Error</Text>
          <Text style={styles.message}>{this.state.message}</Text>
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#0033A0',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
