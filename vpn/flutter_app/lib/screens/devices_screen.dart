import '../services/api_service.dart';
import '../models/device.dart';

class DevicesScreen extends StatefulWidget {
  const DevicesScreen({super.key});

  @override
  State<DevicesScreen> createState() => _DevicesScreenState();
}

class _DevicesScreenState extends State<DevicesScreen> {
  List<Device> _devices = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadDevices();
  }

  Future<void> _loadDevices() async {
    try {
      final devices = await ApiService.getDevices();
      if (mounted) setState(() => _devices = devices);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _addDevice() async {
    final name = await showDialog<String>(
      context: context,
      builder: (context) => _AddDeviceDialog(),
    );
    
    if (name != null) {
      try {
        await ApiService.createDevice(name);
        await _loadDevices();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(e.toString())),
          );
        }
      }
    }
  }

  Future<void> _removeDevice(Device device) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Device'),
        content: Text('Delete "${device.name}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    
    if (confirm == true) {
      try {
        await ApiService.deleteDevice(device.id);
        await _loadDevices();
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(e.toString())),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Devices')),
      floatingActionButton: FloatingActionButton(
        onPressed: _addDevice,
        child: const Icon(Icons.add),
      ),
      body: _isLoading
        ? const Center(child: CircularProgressIndicator())
        : _devices.isEmpty
          ? const Center(child: Text('No devices'))
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _devices.length,
              itemBuilder: (context, index) {
                final device = _devices[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    leading: Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: device.isActive
                          ? const Color(0xFF22C55E).withOpacity(0.1)
                          : Colors.grey.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        Icons.phone_android,
                        color: device.isActive
                          ? const Color(0xFF22C55E)
                          : Colors.grey,
                      ),
                    ),
                    title: Text(device.name),
                    subtitle: Text(
                      device.isActive ? 'Active' : 'Inactive',
                    ),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete_outline),
                      onPressed: () => _removeDevice(device),
                    ),
                  ),
                );
              },
            ),
    );
  }
}

class _AddDeviceDialog extends StatefulWidget {
  @override
  State<_AddDeviceDialog> createState() => _AddDeviceDialogState();
}

class _AddDeviceDialogState extends State<_AddDeviceDialog> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Add Device'),
      content: TextField(
        controller: _controller,
        decoration: const InputDecoration(
          labelText: 'Device Name',
          hintText: 'e.g., iPhone 15',
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: () {
            if (_controller.text.isNotEmpty) {
              Navigator.pop(context, _controller.text);
            }
          },
          child: const Text('Add'),
        ),
      ],
    );
  }
}