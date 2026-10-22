import { useEffect, useState } from 'react';
import Browser from 'webextension-polyfill';
import { nanoid } from 'nanoid';
import {
  Box,
  Button,
  Checkbox,
  HStack,
  IconButton,
  Image,
  Input,
  Link,
  Select,
  Stack,
  Text,
  Textarea,
} from '@chakra-ui/react';
import { FiStar } from 'react-icons/fi';
import Channel from '~/utils/channel';
import { EventName } from '~/types';
import {
  FEEDBACK_CATEGORIES,
  submitFeedback,
  type FeedbackCategory,
} from '~/utils/feedback';

const channel = new Channel();
const MAX_COMMENT = 5000;

type Props = {
  recording: boolean;
  onDone: () => void;
};

export function FeedbackForm({ recording, onDone }: Props) {
  // one id per form: a retried submit is recognised as the same feedback
  const [id] = useState(() => nanoid());
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [contact, setContact] = useState('');
  const [attach, setAttach] = useState(true);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotError, setScreenshotError] = useState('');
  const [state, setState] = useState<'editing' | 'sending' | 'sent'>('editing');
  const [error, setError] = useState('');
  const [link, setLink] = useState('');

  useEffect(() => {
    if (!attach || screenshot) return;
    // the popup covers part of the page, but captureVisibleTab captures the tab itself
    Browser.tabs
      .captureVisibleTab(undefined as unknown as number, {
        format: 'jpeg',
        quality: 70,
      })
      .then(setScreenshot)
      .catch((err: Error) => {
        setScreenshotError(`Screenshot unavailable: ${err.message}`);
        setAttach(false);
      });
  }, [attach, screenshot]);

  const canSubmit = rating !== null || comment.trim().length > 0;

  const submit = async () => {
    setState('sending');
    setError('');
    try {
      const [tab] = await Browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (recording)
        channel.emit(EventName.FeedbackSubmitted, { feedbackId: id, category });
      const result = await submitFeedback({
        id,
        category,
        rating,
        comment: comment.trim(),
        contact: contact.trim(),
        pageUrl: tab?.url || '',
        pageTitle: tab?.title || '',
        viewportWidth: tab?.width,
        viewportHeight: tab?.height,
        userAgent: navigator.userAgent,
        screenshot: attach ? screenshot : null,
        recording,
      });
      setLink(result.url);
      setState('sent');
    } catch (err) {
      setError(String((err as Error).message));
      setState('editing');
    }
  };

  if (state === 'sent')
    return (
      <Stack spacing={2} mt={3}>
        <Text color="green.600" fontWeight="semibold">
          Thanks, feedback saved.
        </Text>
        {recording && (
          <Text fontSize="sm">
            It will be linked to the replay once you stop and save this
            recording.
          </Text>
        )}
        {link && (
          <Link href={link} isExternal fontSize="sm" textDecoration="underline">
            Open in feedback inbox
          </Link>
        )}
        <Button size="sm" onClick={onDone}>
          Close
        </Button>
      </Stack>
    );

  return (
    <Stack spacing={2} mt={3}>
      <Text fontWeight="bold">Give feedback</Text>
      <Select
        size="sm"
        value={category}
        onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
      >
        {FEEDBACK_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </Select>
      <HStack spacing={0} aria-label="Rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <IconButton
            key={value}
            size="sm"
            variant="ghost"
            aria-label={`${value} star${value > 1 ? 's' : ''}`}
            title={`${value} of 5`}
            icon={
              <FiStar
                fill={
                  rating !== null && value <= rating ? 'currentColor' : 'none'
                }
              />
            }
            color={
              rating !== null && value <= rating ? 'orange.400' : 'gray.400'
            }
            onClick={() => setRating(rating === value ? null : value)}
          />
        ))}
        {rating !== null && (
          <Text fontSize="sm" ml={2}>
            {rating}/5
          </Text>
        )}
      </HStack>
      <Textarea
        size="sm"
        placeholder="What happened, or what could be better?"
        value={comment}
        maxLength={MAX_COMMENT}
        onChange={(e) => setComment(e.target.value)}
      />
      <Input
        size="sm"
        placeholder="Your name or email (optional)"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
      />
      <Checkbox
        size="sm"
        isChecked={attach}
        onChange={(e) => {
          setAttach(e.target.checked);
          setScreenshotError('');
        }}
      >
        Attach screenshot of this page
      </Checkbox>
      {attach && screenshot && (
        <Box borderWidth="1px" borderRadius="md" overflow="hidden">
          <Image src={screenshot} alt="Screenshot preview" />
        </Box>
      )}
      {screenshotError && (
        <Text fontSize="xs" color="orange.500">
          {screenshotError}
        </Text>
      )}
      {!canSubmit && (
        <Text fontSize="xs" color="text.muted">
          Add a rating or a comment to submit.
        </Text>
      )}
      {error && (
        <Text fontSize="sm" color="red.500">
          Not saved: {error}. Is the log server running? You can retry.
        </Text>
      )}
      <HStack>
        <Button
          size="sm"
          colorScheme="brand"
          isDisabled={!canSubmit}
          isLoading={state === 'sending'}
          onClick={() => void submit()}
        >
          {error ? 'Retry' : 'Submit'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </HStack>
    </Stack>
  );
}
