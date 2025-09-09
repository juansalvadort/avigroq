import { ChatPage } from '../pages/chat';
import { test, expect } from '../fixtures';

// Ensure the model selector lists newly added OpenAI models

test.describe('Model selector', () => {
  test('shows OpenAI models', async ({ page }) => {
    const chatPage = new ChatPage(page);
    await chatPage.createNewChat();

    await page.getByTestId('model-selector').click();
    await expect(
      page.getByTestId('model-selector-item-gpt-4o-mini'),
    ).toBeVisible();
    await expect(
      page.getByTestId('model-selector-item-o4-mini'),
    ).toBeVisible();
  });
});
