declare namespace chrome {
  namespace runtime {
    interface Port {
      name: string;
      onMessage: {
        addListener(callback: (message: any) => void): void;
      };
      onDisconnect: {
        addListener(callback: () => void): void;
      };
      postMessage(message: any): void;
      disconnect(): void;
    }

    const lastError: { message: string } | undefined;
    const id: string;
    function connectNative(name: string): Port;
    function sendMessage(message: any, callback?: (response: any) => void): void;
    const onMessage: {
      addListener(callback: (message: any, sender: any, sendResponse: (response: any) => void) => boolean | void): void;
    };
    const onStartup: {
      addListener(callback: () => void): void;
    };
    const onInstalled: {
      addListener(callback: () => void): void;
    };
    function openOptionsPage(): void;
  }

  namespace action {
    const onClicked: {
      addListener(callback: (tab: any) => void): void;
    };
  }

  namespace tabs {
    function create(options: { url: string }): void;
  }

  namespace storage {
    namespace sync {
      function get(keys: any, callback: (result: any) => void): void;
      function set(items: any, callback?: () => void): void;
    }
    namespace local {
      function get(keys: any, callback: (result: any) => void): void;
      function set(items: any, callback?: () => void): void;
    }
  }

  namespace serial {
    function requestPort(options?: any): Promise<any>;
    function getPorts(): Promise<any[]>;
  }
}

