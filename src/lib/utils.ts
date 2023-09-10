// These are the dependencies for this file.
export const getChangedFiles = async ({ owner, repo, pullRequestNumber, octokit }) => {
  try {
    const response = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullRequestNumber,
    })

    const changedFiles = response.data.map((file) => {
      return {
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        blobUrl: file.blob_url,
      }
    })

    return changedFiles
  } catch (error) {
    console.error('Error fetching changed files:', error)
  }
}
