import 'package:flutter_test/flutter_test.dart';
import 'package:field_worker_app/main.dart';

void main() {
  testWidgets('App renders home screen', (WidgetTester tester) async {
    await tester.pumpWidget(const CivixFieldApp());
    expect(find.text('Civix Pulse'), findsOneWidget);
  });
}
