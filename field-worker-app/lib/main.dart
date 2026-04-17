import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/app_state.dart';
import 'screens/home_screen.dart';
import 'screens/submit_grievance_screen.dart';
import 'screens/my_complaints_screen.dart';
import 'screens/live_feed_screen.dart';
import 'screens/profile_screen.dart';
import 'theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    ChangeNotifierProvider(
      create: (_) => AppState(),
      child: const CivixFieldApp(),
    ),
  );
}

class CivixFieldApp extends StatelessWidget {
  const CivixFieldApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Civix Pulse — Field Worker',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      initialRoute: '/',
      routes: {
        '/': (_) => const HomeScreen(),
        '/submit': (_) => const SubmitGrievanceScreen(),
        '/my-complaints': (_) => const MyComplaintsScreen(),
        '/live-feed': (_) => const LiveFeedScreen(),
        '/profile': (_) => const ProfileScreen(),
      },
    );
  }
}
