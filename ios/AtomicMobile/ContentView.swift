import SwiftUI

struct ContentView: View {
    @State private var store: AtomStore
    @State private var selectedAtomId: String?
    @State private var showCompose = false
    @State private var showTags = false
    @State private var showSettings = false
    @State private var searchText = ""
    @State private var searchResults: [SearchResult] = []
    @State private var isSearching = false
    @State private var searchTask: Task<Void, Never>?

    @Binding var serverURL: String
    @Binding var apiToken: String

    private let api: APIClient

    init(api: APIClient, serverURL: Binding<String>, apiToken: Binding<String>) {
        self.api = api
        self._store = State(initialValue: AtomStore(api: api))
        self._serverURL = serverURL
        self._apiToken = apiToken
    }

    private var isSearchActive: Bool { !searchText.isEmpty }

    private var selectedTagName: String? {
        guard let id = store.selectedTagId else { return nil }
        return store.tags.first { $0.id == id }?.name
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.bg.ignoresSafeArea()

                Group {
                    if isSearchActive {
                        searchResultsList
                    } else if store.isLoading && store.atoms.isEmpty {
                        ProgressView()
                            .tint(Theme.accent)
                    } else if let error = store.error, store.atoms.isEmpty {
                        errorView(error)
                    } else if store.atoms.isEmpty {
                        emptyView
                    } else {
                        atomList
                    }
                }
            }
            .navigationTitle(selectedTagName ?? "Atomic")
            .toolbarBackground(Theme.bg, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .searchable(text: $searchText, prompt: "Search atoms")
            .onChange(of: searchText) { _, query in
                searchTask?.cancel()
                if query.isEmpty {
                    searchResults = []
                    isSearching = false
                    return
                }
                searchTask = Task {
                    try? await Task.sleep(for: .milliseconds(300))
                    guard !Task.isCancelled else { return }
                    isSearching = true
                    searchResults = await store.search(query: query)
                    isSearching = false
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    HStack(spacing: 12) {
                        Button {
                            showTags = true
                        } label: {
                            Image(systemName: store.selectedTagId != nil ? "tag.fill" : "tag")
                                .fontWeight(.medium)
                        }
                        .tint(store.selectedTagId != nil ? Theme.accent : Theme.textSecondary)

                        Button {
                            showSettings = true
                        } label: {
                            Image(systemName: "gearshape")
                                .fontWeight(.medium)
                        }
                        .tint(Theme.textSecondary)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showCompose = true
                    } label: {
                        Image(systemName: "square.and.pencil")
                            .fontWeight(.medium)
                    }
                    .tint(Theme.accent)
                }
            }
            .sheet(isPresented: $showCompose) {
                ComposeView(api: api) {
                    await store.loadAtoms()
                }
            }
            .sheet(isPresented: $showTags) {
                TagBrowserView(store: store)
            }
            .sheet(isPresented: $showSettings) {
                SettingsView(serverURL: $serverURL, apiToken: $apiToken)
            }
            .navigationDestination(item: $selectedAtomId) { id in
                AtomDetailView(api: api, atomId: id) {
                    await store.loadAtoms()
                }
            }
        }
        .preferredColorScheme(.dark)
        .task {
            await store.loadAtoms()
            await store.loadTags()
        }
    }

    private var atomList: some View {
        List {
            ForEach(store.atoms) { atom in
                AtomCard(atom: atom)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
                    .onTapGesture { selectedAtomId = atom.id }
                    .onAppear {
                        if atom.id == store.atoms.last?.id {
                            Task { await store.loadMore() }
                        }
                    }
            }
            .onDelete { indexSet in
                Task {
                    for index in indexSet {
                        let atom = store.atoms[index]
                        _ = await store.deleteAtom(id: atom.id)
                    }
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .refreshable {
            await store.loadAtoms()
        }
    }

    private var emptyView: some View {
        VStack(spacing: 12) {
            Image(systemName: "doc.text")
                .font(.system(size: 40))
                .foregroundStyle(Theme.textSecondary)
            Text(store.selectedTagId != nil ? "No atoms with this tag" : "No atoms yet")
                .foregroundStyle(Theme.textSecondary)
            if store.selectedTagId == nil {
                Button("Create one") { showCompose = true }
                    .buttonStyle(.bordered)
                    .tint(Theme.accent)
            }
        }
    }

    private var searchResultsList: some View {
        ScrollView {
            if isSearching {
                ProgressView()
                    .tint(Theme.accent)
                    .padding(.top, 40)
            } else if searchResults.isEmpty {
                Text("No results")
                    .foregroundStyle(Theme.textSecondary)
                    .padding(.top, 40)
            } else {
                LazyVStack(spacing: 12) {
                    ForEach(searchResults) { result in
                        SearchResultCard(result: result)
                            .onTapGesture { selectedAtomId = result.id }
                    }
                }
                .padding(.horizontal)
                .padding(.top, 8)
            }
        }
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "wifi.slash")
                .font(.system(size: 40))
                .foregroundStyle(Theme.textSecondary)
            Text(message)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
            Button("Retry") {
                Task { await store.loadAtoms() }
            }
            .buttonStyle(.bordered)
            .tint(Theme.accent)
        }
        .padding()
    }
}
