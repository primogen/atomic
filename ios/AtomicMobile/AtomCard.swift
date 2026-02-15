import SwiftUI

struct AtomCard: View {
    let atom: AtomSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(atom.snippet)
                .font(.subheadline)
                .foregroundStyle(Theme.textPrimary)
                .lineLimit(4)

            HStack(spacing: 8) {
                if !atom.tags.isEmpty {
                    ForEach(atom.tags.prefix(3)) { tag in
                        TagBadge(name: tag.name)
                    }
                    if atom.tags.count > 3 {
                        Text("+\(atom.tags.count - 3)")
                            .font(.caption2)
                            .foregroundStyle(Theme.textSecondary)
                    }
                }

                Spacer()

                Text(relativeDate(atom.updatedAt))
                    .font(.caption2)
                    .foregroundStyle(Theme.textSecondary)
            }
        }
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
    }
}

struct TagBadge: View {
    let name: String

    var body: some View {
        Text(name)
            .font(.caption2)
            .fontWeight(.medium)
            .foregroundStyle(Theme.accent)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Theme.accent.opacity(0.15), in: Capsule())
    }
}

struct SearchResultCard: View {
    let result: SearchResult

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let chunk = result.matchingChunkContent {
                Text(chunk)
                    .font(.subheadline)
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(4)
            } else {
                Text(String(result.content.prefix(200)))
                    .font(.subheadline)
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(4)
            }

            HStack {
                ForEach(result.tags.prefix(2)) { tag in
                    TagBadge(name: tag.name)
                }
                Spacer()
                Text("\(Int(result.similarityScore * 100))% match")
                    .font(.caption2)
                    .foregroundStyle(Theme.accent)
            }
        }
        .padding(14)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 12))
    }
}

private func relativeDate(_ iso: String) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    guard let date = formatter.date(from: iso) else {
        // Try without fractional seconds
        formatter.formatOptions = [.withInternetDateTime]
        guard let date = formatter.date(from: iso) else { return "" }
        return RelativeDateTimeFormatter().localizedString(for: date, relativeTo: .now)
    }
    return RelativeDateTimeFormatter().localizedString(for: date, relativeTo: .now)
}
