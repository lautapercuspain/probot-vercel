// These are the dependencies for this file.
export const getChangedFiles = async ({ owner, repo, pullRequestNumber, octokit }) => {
  try {
    const response = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: pullRequestNumber,
    })
    // console.log('response:', response)
    //comment
    const changedFiles = response.data?.map((file) => {
      return {
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        blobUrl: file.blob_url,
        raw_url: file.raw_url,
        patch: file.patch,
        contents_url: file.contents_url,
      }
    })
    return changedFiles
  } catch (error) {
    console.error('Error fetching changed files:', error)
  }
}

export function removeCharacters(fileContent) {
  // Remove the first line
  const lines = fileContent.split('\n').slice(1)

  // Remove the characters "@@ -0,0 +1,46 @@"
  const filteredContent = lines.map((line) => line.replace(/@@ -0,0 \+1,46 @@/g, '')).join('\n')

  // Remove the "+" character
  const finalContent = filteredContent.replace(/\+/g, '')

  return finalContent
}
