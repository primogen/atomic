import SwiftUI

@main
struct AtomicApp: App {
    @State private var serverURL = UserDefaults.standard.string(forKey: "serverURL") ?? ""
    @State private var apiToken = UserDefaults.standard.string(forKey: "apiToken") ?? ""

    var body: some Scene {
        WindowGroup {
            if let api = makeClient() {
                ContentView(api: api, serverURL: $serverURL, apiToken: $apiToken)
            } else {
                SetupView(serverURL: $serverURL, apiToken: $apiToken)
            }
        }
    }

    private func makeClient() -> APIClient? {
        guard !serverURL.isEmpty, !apiToken.isEmpty,
              let url = URL(string: serverURL) else { return nil }
        return APIClient(baseURL: url, token: apiToken)
    }
}

struct SetupView: View {
    @Binding var serverURL: String
    @Binding var apiToken: String

    @State private var urlInput = ""
    @State private var tokenInput = ""
    @State private var isTesting = false
    @State private var testError: String?

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()

            VStack(spacing: 32) {
                VStack(spacing: 8) {
                    Text("Atomic")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .foregroundStyle(Theme.textPrimary)
                    Text("Connect to your server")
                        .font(.subheadline)
                        .foregroundStyle(Theme.textSecondary)
                }

                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Server URL")
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                        TextField("http://192.168.1.100:8080", text: $urlInput)
                            .textFieldStyle(.plain)
                            .padding(12)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 10))
                            .foregroundStyle(Theme.textPrimary)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .keyboardType(.URL)
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("API Token")
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                        SecureField("Token", text: $tokenInput)
                            .textFieldStyle(.plain)
                            .padding(12)
                            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 10))
                            .foregroundStyle(Theme.textPrimary)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                    }
                }
                .padding(.horizontal, 24)

                if let error = testError {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .padding(.horizontal, 24)
                }

                Button {
                    Task { await connect() }
                } label: {
                    if isTesting {
                        ProgressView()
                            .tint(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                    } else {
                        Text("Connect")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                    }
                }
                .background(Theme.accent, in: RoundedRectangle(cornerRadius: 12))
                .foregroundStyle(.white)
                .padding(.horizontal, 24)
                .disabled(urlInput.isEmpty || tokenInput.isEmpty || isTesting)
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            urlInput = serverURL
            tokenInput = apiToken
        }
    }

    private func connect() async {
        isTesting = true
        testError = nil

        guard let url = URL(string: urlInput) else {
            testError = "Invalid URL"
            isTesting = false
            return
        }

        let client = APIClient(baseURL: url, token: tokenInput)
        do {
            _ = try await client.listAtoms(limit: 1, offset: 0)
            UserDefaults.standard.set(urlInput, forKey: "serverURL")
            UserDefaults.standard.set(tokenInput, forKey: "apiToken")
            serverURL = urlInput
            apiToken = tokenInput
        } catch {
            testError = "Connection failed: \(error.localizedDescription)"
        }
        isTesting = false
    }
}
