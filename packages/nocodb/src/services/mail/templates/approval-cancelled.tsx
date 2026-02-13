import {
  Body,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import {
  ContentWrapper,
  Footer,
  RootWrapper,
} from '~/services/mail/templates/components';

interface ApprovalCancelledTemplateProps {
  approverName: string;
  title: string;
  baseTitle: string;
  cancelledByName: string;
  cancelledByEmail: string;
  reason?: string;
  cancelledAt: string;
}

export const ApprovalCancelled = ({
  approverName,
  title,
  baseTitle,
  cancelledByName,
  cancelledByEmail,
  reason,
  cancelledAt,
}: ApprovalCancelledTemplateProps) => (
  <Html>
    <RootWrapper>
      <Head />
      <Preview>Approval request cancelled: {title}</Preview>
      <Body className="bg-white">
        <ContentWrapper>
          <Heading className="text-gray-900 text-center font-bold m-auto text-xl md:text-2xl">
            Approval Cancelled
          </Heading>
          <Section className="py-4 mx-auto text-center text-gray-900 text-base">
            <Text className="text-gray-600 text-sm !mt-0 !mb-2">
              Hello <span className="font-bold text-gray-800">{approverName}</span>,
            </Text>
            <Text className="text-gray-600 text-sm !mt-0 !mb-4">
              An approval request assigned to you has been cancelled by{' '}
              <span className="font-bold text-gray-800">{cancelledByName}</span> ({cancelledByEmail}).
            </Text>
          </Section>

          <Section className="bg-gray-100 rounded-lg p-4 my-4">
            <Text className="font-bold text-gray-900 text-base !mt-0 !mb-2">
              {title}
            </Text>
            <Text className="text-gray-500 text-xs !mt-2 !mb-0">
              Base: {baseTitle}
            </Text>
            <Text className="text-gray-500 text-xs !mt-1 !mb-0">
              Cancelled at: {cancelledAt}
            </Text>
          </Section>

          {reason && (
            <Section className="bg-yellow-50 rounded-lg p-4 my-4 border border-yellow-200">
              <Text className="text-gray-700 text-sm !mt-0 !mb-0">
                <span className="font-semibold">Reason:</span> {reason}
              </Text>
            </Section>
          )}

          <Text className="text-gray-500 text-xs text-center !mt-4 !mb-0">
            No further action is required from you on this approval request.
          </Text>
        </ContentWrapper>
        <Footer />
      </Body>
    </RootWrapper>
  </Html>
);

ApprovalCancelled.PreviewProps = {
  approverName: 'Jane Smith',
  title: 'Q4 Budget Approval',
  baseTitle: 'Finance Management',
  cancelledByName: 'John Doe',
  cancelledByEmail: 'john@example.com',
  reason: 'Budget proposal needs to be revised before approval.',
  cancelledAt: '2024-12-15 10:30 AM',
};

export default ApprovalCancelled;
