import SwiftUI

struct SettingsView: View {
    @Binding var serverURL: String
    @Binding var apiToken: String
    @Environment(\.dismiss) private var dismiss
    @State private var showDisconnectConfirm = false

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.bg.ignoresSafeArea()

                List {
                    Section {
                        HStack {
                            Text("Server")
                                .foregroundStyle(Theme.textSecondary)
                            Spacer()
                            Text(serverURL)
                                .foregroundStyle(Theme.textPrimary)
                                .lineLimit(1)
                                .truncationMode(.middle)
                        }
                        .listRowBackground(Theme.surface)

                        HStack {
                            Text("Token")
                                .foregroundStyle(Theme.textSecondary)
                            Spacer()
                            Text(String(repeating: "\u{2022}", count: 12))
                                .foregroundStyle(Theme.textPrimary)
                        }
                        .listRowBackground(Theme.surface)
                    } header: {
                        Text("Connection")
                            .foregroundStyle(Theme.textSecondary)
                    }

                    Section {
                        Button(role: .destructive) {
                            showDisconnectConfirm = true
                        } label: {
                            HStack {
                                Spacer()
                                Text("Disconnect")
                                Spacer()
                            }
                        }
                        .listRowBackground(Theme.surface)
                    }

                    Section {
                        HStack {
                            Text("Version")
                                .foregroundStyle(Theme.textSecondary)
                            Spacer()
                            Text(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.1.0")
                                .foregroundStyle(Theme.textPrimary)
                        }
                        .listRowBackground(Theme.surface)
                    } header: {
                        Text("About")
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
                .scrollContentBackground(.hidden)
                .listStyle(.insetGrouped)
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .tint(Theme.accent)
                }
            }
            .confirmationDialog("Disconnect from server?", isPresented: $showDisconnectConfirm, titleVisibility: .visible) {
                Button("Disconnect", role: .destructive) {
                    disconnect()
                }
            } message: {
                Text("You'll need to re-enter your server details to reconnect.")
            }
        }
        .preferredColorScheme(.dark)
        .presentationBackground(Theme.bg)
    }

    private func disconnect() {
        UserDefaults.standard.removeObject(forKey: "serverURL")
        UserDefaults.standard.removeObject(forKey: "apiToken")
        serverURL = ""
        apiToken = ""
        dismiss()
    }
}
