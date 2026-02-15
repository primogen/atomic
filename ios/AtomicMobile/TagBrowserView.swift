import SwiftUI

struct TagBrowserView: View {
    @Bindable var store: AtomStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.bg.ignoresSafeArea()

                if store.tags.isEmpty {
                    ProgressView()
                        .tint(Theme.accent)
                } else {
                    List {
                        Button {
                            Task {
                                await store.selectTag(nil)
                                dismiss()
                            }
                        } label: {
                            HStack {
                                Text("All Atoms")
                                    .foregroundStyle(Theme.textPrimary)
                                Spacer()
                                if store.selectedTagId == nil {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(Theme.accent)
                                }
                            }
                        }
                        .listRowBackground(Theme.surface)

                        ForEach(parentTags) { parent in
                            Section {
                                ForEach(childTags(of: parent.id)) { tag in
                                    tagRow(tag)
                                }
                            } header: {
                                Text(parent.name)
                                    .foregroundStyle(Theme.textSecondary)
                                    .font(.caption)
                                    .fontWeight(.semibold)
                            }
                        }

                        if !uncategorizedTags.isEmpty {
                            Section {
                                ForEach(uncategorizedTags) { tag in
                                    tagRow(tag)
                                }
                            } header: {
                                Text("Other")
                                    .foregroundStyle(Theme.textSecondary)
                                    .font(.caption)
                                    .fontWeight(.semibold)
                            }
                        }
                    }
                    .scrollContentBackground(.hidden)
                    .listStyle(.insetGrouped)
                }
            }
            .navigationTitle("Tags")
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
        }
        .preferredColorScheme(.dark)
        .presentationBackground(Theme.bg)
        .task {
            await store.loadTags()
        }
    }

    private func tagRow(_ tag: Tag) -> some View {
        Button {
            Task {
                await store.selectTag(tag.id)
                dismiss()
            }
        } label: {
            HStack {
                Text(tag.name)
                    .foregroundStyle(Theme.textPrimary)
                Spacer()
                if store.selectedTagId == tag.id {
                    Image(systemName: "checkmark")
                        .foregroundStyle(Theme.accent)
                }
            }
        }
        .listRowBackground(Theme.surface)
    }

    private var parentTags: [Tag] {
        store.tags.filter { $0.parentId == nil && hasChildren($0.id) }
    }

    private func childTags(of parentId: String) -> [Tag] {
        store.tags.filter { $0.parentId == parentId }.sorted { $0.name < $1.name }
    }

    private func hasChildren(_ id: String) -> Bool {
        store.tags.contains { $0.parentId == id }
    }

    private var uncategorizedTags: [Tag] {
        store.tags.filter { $0.parentId == nil && !hasChildren($0.id) }
            .sorted { $0.name < $1.name }
    }
}
