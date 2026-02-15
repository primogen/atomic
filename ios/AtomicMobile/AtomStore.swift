import Foundation
import SwiftUI

@Observable @MainActor
final class AtomStore {
    var atoms: [AtomSummary] = []
    var totalCount = 0
    var isLoading = false
    var error: String?
    var tags: [Tag] = []
    var selectedTagId: String?

    private let api: APIClient

    init(api: APIClient) {
        self.api = api
    }

    func loadAtoms() async {
        isLoading = true
        error = nil
        do {
            let response = try await api.listAtoms(limit: 50, offset: 0, tagId: selectedTagId)
            atoms = response.atoms
            totalCount = response.totalCount
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func loadMore() async {
        guard !isLoading, atoms.count < totalCount else { return }
        isLoading = true
        do {
            let response = try await api.listAtoms(limit: 50, offset: atoms.count, tagId: selectedTagId)
            atoms.append(contentsOf: response.atoms)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    func loadTags() async {
        do {
            tags = try await api.getTags()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func selectTag(_ tagId: String?) async {
        selectedTagId = tagId
        await loadAtoms()
    }

    func createAtom(content: String) async -> Atom? {
        do {
            let atom = try await api.createAtom(content: content)
            await loadAtoms()
            return atom
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func updateAtom(id: String, content: String) async -> Atom? {
        do {
            let atom = try await api.updateAtom(id: id, content: content)
            await loadAtoms()
            return atom
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func deleteAtom(id: String) async -> Bool {
        do {
            try await api.deleteAtom(id: id)
            atoms.removeAll { $0.id == id }
            totalCount -= 1
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    func search(query: String) async -> [SearchResult] {
        do {
            return try await api.search(query: query)
        } catch {
            self.error = error.localizedDescription
            return []
        }
    }
}
