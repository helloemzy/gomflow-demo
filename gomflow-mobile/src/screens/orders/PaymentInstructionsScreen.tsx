import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { Text, Button, Card, Chip, Divider, ActivityIndicator } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';

import { RootStackParamList } from '../../types';
import { RootState } from '../../store';
import { COLORS } from '../../constants';

type PaymentInstructionsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'PaymentInstructions'>;
type PaymentInstructionsScreenRouteProp = RouteProp<RootStackParamList, 'PaymentInstructions'>;

interface PaymentDetails {
  orderId: string;
  submissionId: string;
  orderTitle: string;
  totalAmount: number;
  currency: 'PHP' | 'MY';
  paymentMethod: string;
  paymentReference: string;
  gomName: string;
  deadline: string;
}

const PaymentInstructionsScreen = () => {
  const navigation = useNavigation<PaymentInstructionsScreenNavigationProp>();
  const route = useRoute<PaymentInstructionsScreenRouteProp>();
  const { user } = useSelector((state: RootState) => state.auth);
  
  const { orderId, submissionId } = route.params;
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofUploaded, setProofUploaded] = useState(false);

  useEffect(() => {
    fetchPaymentDetails();
  }, [orderId, submissionId]);

  const fetchPaymentDetails = async () => {
    try {
      // TODO: Implement API call to fetch payment details
      console.log('Fetching payment details for:', { orderId, submissionId });
      
      // Simulate API call with sample data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const samplePaymentDetails: PaymentDetails = {
        orderId,
        submissionId,
        orderTitle: 'SEVENTEEN "God of Music" Limited Edition',
        totalAmount: 1950, // 3 × 650
        currency: user?.country === 'PH' ? 'PHP' : 'MY',
        paymentMethod: user?.country === 'PH' ? 'gcash' : 'touch_n_go',
        paymentReference: `GO${Date.now().toString().slice(-8)}`,
        gomName: 'KPop Manila Store',
        deadline: '2025-01-25T23:59:59Z',
      };
      
      setPaymentDetails(samplePaymentDetails);
    } catch (error) {
      console.error('Error fetching payment details:', error);
      Alert.alert('Error', 'Failed to load payment details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getPaymentInstructions = (method: string, currency: 'PHP' | 'MY') => {
    const instructions: Record<string, any> = {
      gcash: {
        name: 'GCash',
        steps: [
          'Open your GCash app',
          'Tap "Send Money"',
          'Enter the GCash number: 09XX-XXX-XXXX',
          `Send exactly ${currency === 'PHP' ? '₱' : 'RM'}${paymentDetails?.totalAmount.toLocaleString()}`,
          'Add payment reference in the message',
          'Take a screenshot of the confirmation',
        ],
        accountInfo: '09XX-XXX-XXXX',
        accountName: paymentDetails?.gomName || 'GOM',
      },
      paymaya: {
        name: 'PayMaya',
        steps: [
          'Open your PayMaya app',
          'Tap "Send Money"',
          'Enter the mobile number: 09XX-XXX-XXXX',
          `Send exactly ${currency === 'PHP' ? '₱' : 'RM'}${paymentDetails?.totalAmount.toLocaleString()}`,
          'Add payment reference in the notes',
          'Take a screenshot of the confirmation',
        ],
        accountInfo: '09XX-XXX-XXXX',
        accountName: paymentDetails?.gomName || 'GOM',
      },
      bank_transfer: {
        name: 'Bank Transfer',
        steps: [
          'Log in to your online banking or visit the bank',
          'Select "Fund Transfer" or "Send Money"',
          'Enter the account details below',
          `Transfer exactly ${currency === 'PHP' ? '₱' : 'RM'}${paymentDetails?.totalAmount.toLocaleString()}`,
          'Use the payment reference as the transfer description',
          'Save or screenshot the transfer confirmation',
        ],
        accountInfo: currency === 'PHP' ? 'BPI - 1234-5678-90' : 'Maybank - 123456789012',
        accountName: paymentDetails?.gomName || 'GOM',
      },
      touch_n_go: {
        name: 'Touch n Go eWallet',
        steps: [
          'Open your Touch n Go eWallet app',
          'Tap "Transfer"',
          'Enter the phone number: +60XX-XXX-XXXX',
          `Send exactly ${currency === 'PHP' ? '₱' : 'RM'}${paymentDetails?.totalAmount.toLocaleString()}`,
          'Add payment reference in the notes',
          'Take a screenshot of the confirmation',
        ],
        accountInfo: '+60XX-XXX-XXXX',
        accountName: paymentDetails?.gomName || 'GOM',
      },
      maybank: {
        name: 'Maybank2u',
        steps: [
          'Log in to Maybank2u online banking',
          'Select "Transfer" > "To Other Maybank Account"',
          'Enter the account number below',
          `Transfer exactly ${currency === 'PHP' ? '₱' : 'RM'}${paymentDetails?.totalAmount.toLocaleString()}`,
          'Enter payment reference in the description',
          'Save the transfer receipt',
        ],
        accountInfo: '123456789012',
        accountName: paymentDetails?.gomName || 'GOM',
      },
      cimb: {
        name: 'CIMB Clicks',
        steps: [
          'Log in to CIMB Clicks online banking',
          'Select "Transfer" > "To CIMB Account"',
          'Enter the account number below',
          `Transfer exactly ${currency === 'PHP' ? '₱' : 'RM'}${paymentDetails?.totalAmount.toLocaleString()}`,
          'Enter payment reference in the description',
          'Save the transfer receipt',
        ],
        accountInfo: '800012345678',
        accountName: paymentDetails?.gomName || 'GOM',
      },
    };

    return instructions[method] || instructions.gcash;
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      // For React Native, you'd use @react-native-clipboard/clipboard
      // For now, we'll show an alert
      Alert.alert('Copied!', `${label} copied to clipboard: ${text}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
  };

  const handleUploadProof = async () => {
    Alert.alert(
      'Upload Payment Proof',
      'How would you like to provide your payment proof?',
      [
        {
          text: 'Take Photo',
          onPress: uploadFromCamera,
        },
        {
          text: 'Choose from Gallery',
          onPress: uploadFromGallery,
        },
        {
          text: 'Select File',
          onPress: uploadFromFiles,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const uploadFromCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
        return;
      }

      setUploadingProof(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await processUpload(result.assets[0]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    } finally {
      setUploadingProof(false);
    }
  };

  const uploadFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Photo library permission is needed to select images.');
        return;
      }

      setUploadingProof(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await processUpload(result.assets[0]);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    } finally {
      setUploadingProof(false);
    }
  };

  const uploadFromFiles = async () => {
    try {
      setUploadingProof(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        await processUpload(result.assets[0]);
      }
    } catch (error) {
      console.error('Error selecting file:', error);
      Alert.alert('Error', 'Failed to select file. Please try again.');
    } finally {
      setUploadingProof(false);
    }
  };

  const processUpload = async (file: any) => {
    try {
      // TODO: Implement actual file upload to API
      console.log('Uploading payment proof:', file);
      
      // Simulate upload process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setProofUploaded(true);
      Alert.alert(
        'Success!',
        'Your payment proof has been uploaded successfully. The GOM will verify your payment and update your order status.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Main'),
          },
        ]
      );
    } catch (error) {
      console.error('Error uploading proof:', error);
      Alert.alert('Error', 'Failed to upload payment proof. Please try again.');
    }
  };

  const handleContactGOM = () => {
    Alert.alert(
      'Contact GOM',
      `Contact ${paymentDetails?.gomName} for payment assistance.`,
      [
        {
          text: 'WhatsApp',
          onPress: () => {
            // TODO: Open WhatsApp with GOM's number
            Linking.openURL('https://wa.me/63XXXXXXXXX');
          },
        },
        {
          text: 'Telegram',
          onPress: () => {
            // TODO: Open Telegram with GOM's username
            Linking.openURL('https://t.me/gomusername');
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const formatDeadline = (deadline: string) => {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    
    if (diffHours < 0) return 'Payment overdue';
    if (diffHours < 24) return `${diffHours} hours left`;
    const diffDays = Math.ceil(diffHours / 24);
    return `${diffDays} days left`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading payment details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!paymentDetails) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Payment details not found</Text>
          <Button mode="outlined" onPress={() => navigation.goBack()}>
            Go Back
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const instructions = getPaymentInstructions(paymentDetails.paymentMethod, paymentDetails.currency);
  const deadlineText = formatDeadline(paymentDetails.deadline);
  const isUrgent = deadlineText.includes('hours') || deadlineText.includes('overdue');

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Button
          mode="text"
          onPress={() => navigation.goBack()}
          icon="arrow-left"
          compact
          textColor={COLORS.text}
        >
          Back
        </Button>
        <Text style={styles.headerTitle}>Payment Instructions</Text>
        <Button
          mode="text"
          onPress={handleContactGOM}
          icon="help"
          compact
          textColor={COLORS.text}
        >
          Help
        </Button>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Payment Summary */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <MaterialIcons name="receipt" size={24} color={COLORS.primary} />
            <Text style={styles.summaryTitle}>Payment Summary</Text>
          </View>
          
          <View style={styles.summaryContent}>
            <Text style={styles.orderTitle}>{paymentDetails.orderTitle}</Text>
            <Text style={styles.gomName}>by {paymentDetails.gomName}</Text>
            
            <Divider style={styles.divider} />
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Amount</Text>
              <Text style={styles.summaryAmount}>
                {paymentDetails.currency === 'PHP' ? '₱' : 'RM'}{paymentDetails.totalAmount.toLocaleString()}
              </Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Payment Method</Text>
              <Text style={styles.summaryValue}>{instructions.name}</Text>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Reference Number</Text>
              <View style={styles.referenceContainer}>
                <Text style={styles.referenceText}>{paymentDetails.paymentReference}</Text>
                <Button
                  mode="text"
                  onPress={() => copyToClipboard(paymentDetails.paymentReference, 'Reference number')}
                  icon="content-copy"
                  compact
                >
                  Copy
                </Button>
              </View>
            </View>
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Payment Deadline</Text>
              <Text style={[
                styles.summaryValue,
                isUrgent && { color: COLORS.error, fontWeight: '600' }
              ]}>
                {deadlineText}
              </Text>
            </View>
          </View>
        </Card>

        {/* Payment Instructions */}
        <Card style={styles.instructionsCard}>
          <View style={styles.instructionsHeader}>
            <MaterialIcons name="list" size={24} color={COLORS.success} />
            <Text style={styles.instructionsTitle}>Payment Instructions</Text>
          </View>

          <View style={styles.accountInfo}>
            <Text style={styles.accountLabel}>Send payment to:</Text>
            <View style={styles.accountContainer}>
              <View style={styles.accountDetails}>
                <Text style={styles.accountNumber}>{instructions.accountInfo}</Text>
                <Text style={styles.accountName}>{instructions.accountName}</Text>
              </View>
              <Button
                mode="outlined"
                onPress={() => copyToClipboard(instructions.accountInfo, 'Account info')}
                icon="content-copy"
                compact
                style={styles.copyButton}
              >
                Copy
              </Button>
            </View>
          </View>

          <View style={styles.stepsContainer}>
            <Text style={styles.stepsTitle}>Follow these steps:</Text>
            {instructions.steps.map((step: string, index: number) => (
              <View key={index} style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Important Notes */}
        <Card style={styles.notesCard}>
          <View style={styles.notesHeader}>
            <MaterialIcons name="warning" size={24} color={COLORS.warning} />
            <Text style={styles.notesTitle}>Important Notes</Text>
          </View>
          
          <View style={styles.notesList}>
            <Text style={styles.noteItem}>
              • Send the EXACT amount: {paymentDetails.currency === 'PHP' ? '₱' : 'RM'}{paymentDetails.totalAmount.toLocaleString()}
            </Text>
            <Text style={styles.noteItem}>
              • Include the reference number: {paymentDetails.paymentReference}
            </Text>
            <Text style={styles.noteItem}>
              • Take a clear screenshot of your payment confirmation
            </Text>
            <Text style={styles.noteItem}>
              • Upload your payment proof below to confirm your order
            </Text>
            <Text style={styles.noteItem}>
              • Contact the GOM if you encounter any issues
            </Text>
          </View>
        </Card>

        {/* Upload Payment Proof */}
        <Card style={styles.uploadCard}>
          <View style={styles.uploadHeader}>
            <MaterialIcons name="cloud-upload" size={24} color={COLORS.primary} />
            <Text style={styles.uploadTitle}>Upload Payment Proof</Text>
          </View>
          
          <Text style={styles.uploadDescription}>
            After making your payment, upload a screenshot or photo of your payment confirmation to complete your order.
          </Text>

          {proofUploaded ? (
            <View style={styles.uploadSuccess}>
              <MaterialIcons name="check-circle" size={48} color={COLORS.success} />
              <Text style={styles.uploadSuccessText}>Payment proof uploaded successfully!</Text>
              <Text style={styles.uploadSuccessSubtext}>
                Your payment will be verified by the GOM within 24 hours.
              </Text>
            </View>
          ) : (
            <Button
              mode="contained"
              onPress={handleUploadProof}
              loading={uploadingProof}
              disabled={uploadingProof}
              style={styles.uploadButton}
              icon="camera"
              contentStyle={styles.uploadButtonContent}
            >
              {uploadingProof ? 'Uploading...' : 'Upload Payment Proof'}
            </Button>
          )}
        </Card>

        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  summaryCard: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    elevation: 2,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginLeft: 8,
  },
  summaryContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  gomName: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  divider: {
    marginVertical: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  referenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  referenceText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginRight: 8,
  },
  instructionsCard: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    elevation: 2,
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 8,
  },
  accountInfo: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  accountLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  accountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: `${COLORS.success}20`,
    padding: 12,
    borderRadius: 8,
  },
  accountDetails: {
    flex: 1,
  },
  accountNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  accountName: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  copyButton: {
    borderColor: COLORS.success,
  },
  stepsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  stepsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  notesCard: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 8,
  },
  notesList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  noteItem: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  uploadCard: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    elevation: 2,
  },
  uploadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 8,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: 8,
  },
  uploadDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  uploadButton: {
    backgroundColor: COLORS.primary,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
  },
  uploadButtonContent: {
    height: 48,
  },
  uploadSuccess: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  uploadSuccessText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.success,
    marginTop: 12,
    marginBottom: 8,
  },
  uploadSuccessSubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default PaymentInstructionsScreen;