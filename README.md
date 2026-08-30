# Welcome to LinkedIn Easy Apply AutoApply by Kendrashya Diwakar

This extension automates the application process for LinkedIn Easy Apply job postings, making it easier to apply to multiple jobs quickly.

## Features

- Fills recognized fields from values saved in the extension settings.
- Automatically clicks the following buttons on LinkedIn job postings:
  - "Easy Apply" button
  - "Next" button
  - "Review your application" button
  - "Submit application" button
  - "Done" button
- Pauses when required fields cannot be answered safely.
- Pauses at final review by default. Automatic submission is an explicit opt-in.
- Handles text, numeric, select, radio, checkbox, and autocomplete/combobox controls.

## Installation

1. Download the extension files.
2. Copy `.env.example` to `.env` and enter your private autofill values.
3. Run `npm run build` to generate the ignored `profile.config.js` file.
4. Open Chrome and go to `chrome://extensions/`.
5. Enable "Developer mode" in the top right corner.
6. Click "Load unpacked" and select the folder containing the extension files.
7. The extension should now be installed and active.

The `.env` and generated `profile.config.js` files are excluded from Git so private application data is not committed.

## Usage

- Navigate to a LinkedIn job posting that supports Easy Apply.
- Open the extension settings and enter only the answers you want it to use.
- Click **Auto Apply** from the popup to start the current application.
- You can pause or resume the auto-apply process using the extension's popup interface.
- Use the on-page panel to pause, resume, or stop the process.
- Review unanswered fields and the completed application before submitting.

## Future Improvements

- Currently, the extension only supports the default LinkedIn Easy Apply for only one job posting at a time. In order to apply to multiple job postings, you will click on the next job posting then press pause and resume button. Once the resume button is pressed, it will automatically apply to the next job posting. I'm looking forward to fixing this issue in a way that it will automatically apply to multiple job postings without the need to press pause and resume button.

## Want to contribute?

If you have suggestions or improvements, feel free to open an issue or submit a pull request. You can contact Kendrashya Diwakar at [kendrashya20@gmail.com](mailto:kendrashya20@gmail.com) or on [LinkedIn](https://www.linkedin.com/in/kendrashya-diwakar-93037a1ab/).

## Contributors

As of now, I am the only contributor to this project. If you would like to contribute, please feel free to reach out!

<table>
  <tr>
    <td>
      <img src="logo.svg" width="100" alt="Kendrashya Diwakar">
    </td>
    <td>
      <strong>Kendrashya Diwakar</strong><br>
    </td>
  </tr>
</table>
