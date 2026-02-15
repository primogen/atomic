import SwiftUI

struct ComposeView: View {
    let api: APIClient
    let editingAtom: Atom?
    let onSave: () async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var content = ""
    @State private var isSaving = false
    @FocusState private var isFocused: Bool

    init(api: APIClient, editing atom: Atom? = nil, onSave: @escaping () async -> Void) {
        self.api = api
        self.editingAtom = atom
        self.onSave = onSave
    }

    private var isEditing: Bool { editingAtom != nil }
    private var title: String { isEditing ? "Edit Atom" : "New Atom" }
    private var canSave: Bool {
        !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSaving
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.bg.ignoresSafeArea()

                TextEditor(text: $content)
                    .focused($isFocused)
                    .scrollContentBackground(.hidden)
                    .foregroundStyle(Theme.textPrimary)
                    .font(.body)
                    .padding(.horizontal, 12)
                    .padding(.top, 8)
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                        .tint(Theme.textSecondary)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await save() }
                    } label: {
                        if isSaving {
                            ProgressView()
                                .tint(Theme.accent)
                        } else {
                            Text("Save")
                                .fontWeight(.semibold)
                        }
                    }
                    .tint(Theme.accent)
                    .disabled(!canSave)
                }
            }
            .onAppear {
                if let editingAtom {
                    content = editingAtom.content
                }
                isFocused = true
            }
        }
        .presentationBackground(Theme.bg)
    }

    private func save() async {
        isSaving = true
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        if let editingAtom {
            _ = try? await api.updateAtom(id: editingAtom.id, content: trimmed)
        } else {
            _ = try? await api.createAtom(content: trimmed)
        }
        await onSave()
        dismiss()
    }
}
